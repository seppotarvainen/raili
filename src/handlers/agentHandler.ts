import * as path from 'path';
import {
  approveAll,
  type AssistantMessageEvent,
  CopilotClient,
  CopilotSession,
  type SessionConfig,
} from '@github/copilot-sdk';
import { getFileSystem } from '../infrastructure/fileSystemProvider';
import { AgentRegistry } from '../registry/agentRegistry';
import { resolveRegistryPath } from '../context/pathUtils';
import { readLatestNRuns } from '../context/outputStore';
import { CancellationToken, TokenUsage } from '../types';

interface AgentExecutionResult {
  success: boolean;
  cancelled?: boolean;
  stdout: string;
  stderr: string;
  tokens?: TokenUsage;
}

function parseFrontmatterModel(content: string): string | undefined {
  const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(content);
  if (!match) return undefined;
  const modelLine = match[1].split(/\r?\n/).find((line) => line.startsWith('model:'));
  return modelLine ? modelLine.replace(/^model:\s*/, '').trim() : undefined;
}

function agentPrompt(content: string): string {
  return content.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '');
}

function unavailableNumber(value: number | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : -1;
}

function aggregateModelUsage(
  metrics: Awaited<ReturnType<CopilotSession['rpc']['usage']['getMetrics']>>,
  field: 'inputTokens' | 'outputTokens' | 'cacheReadTokens',
): number {
  const values = Object.values(metrics.modelMetrics)
    .map((modelMetric) => modelMetric?.usage[field])
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));

  if (values.length > 0) return values.reduce((total, value) => total + value, 0);

  if (field === 'inputTokens') return unavailableNumber(metrics.lastCallInputTokens);
  if (field === 'outputTokens') return unavailableNumber(metrics.lastCallOutputTokens);
  return -1;
}

function displayNumber(value: number): string {
  return value < 0 ? 'N/A' : String(value);
}

function displayCredits(credits: number, elapsed: number): string {
  return credits < 0 || elapsed < 0 ? 'N/A' : `AI Credits ${credits} (${elapsed}s)`;
}

function mapUsage(
  metrics: Awaited<ReturnType<CopilotSession['rpc']['usage']['getMetrics']>>,
): TokenUsage {
  const input = aggregateModelUsage(metrics, 'inputTokens');
  const output = aggregateModelUsage(metrics, 'outputTokens');
  const cached = aggregateModelUsage(metrics, 'cacheReadTokens');
  const credits = unavailableNumber(
    metrics.totalNanoAiu === undefined ? undefined : metrics.totalNanoAiu / 1_000_000_000,
  );
  const elapsed = unavailableNumber(
    Number.isFinite(metrics.totalApiDurationMs)
      ? Math.round(metrics.totalApiDurationMs / 1000)
      : undefined,
  );

  return {
    input,
    cached,
    output,
    input_display: displayNumber(input),
    cached_display: displayNumber(cached),
    output_display: displayNumber(output),
    ai_credits: credits,
    ai_display: displayCredits(credits, elapsed),
    ai_time: elapsed,
  };
}

function extractAssistantContent(response: AssistantMessageEvent | undefined): string {
  const content = response?.data.content;
  if (typeof content !== 'string' || content.trim() === '') {
    throw new Error('Copilot SDK returned no assistant content');
  }
  return content;
}

function sendAndWaitForIdle(
  session: CopilotSession,
  prompt: string,
  cancellation: Promise<void>,
): Promise<{ response: AssistantMessageEvent | undefined; receivedDelta: boolean }> {
  return new Promise((resolve, reject) => {
    let latestAssistantMessage: AssistantMessageEvent | undefined;
    let receivedDelta = false;
    let settled = false;
    let unsubscribe: (() => void) | undefined;

    const finish = (callback: () => void): void => {
      if (settled) return;
      settled = true;
      unsubscribe?.();
      callback();
    };

    unsubscribe = session.on((event) => {
      if (event.type === 'assistant.message_delta') {
        receivedDelta = true;
        process.stdout.write(event.data.deltaContent);
      } else if (event.type === 'assistant.message') {
        latestAssistantMessage = event;
      } else if (event.type === 'session.idle') {
        finish(() => resolve({ response: latestAssistantMessage, receivedDelta }));
      } else if (event.type === 'session.error') {
        finish(() => reject(new Error(event.data.message)));
      }
    });

    void session.send({ prompt }).catch((error: unknown) => finish(() => reject(error)));
    void cancellation.then(() => finish(() => resolve({ response: undefined, receivedDelta })));
  });
}

function describeSdkError(operation: string, error: unknown): Error {
  const message = error instanceof Error ? error.message : String(error);
  return new Error(`Copilot SDK ${operation} failed: ${message}`);
}

export async function executeAgent(
  registry: AgentRegistry,
  agentId: string,
  cwd: string,
  previousOutputPath?: string | null,
  prompt?: string,
  useLatest?: number | null,
  workflowArg?: string,
  cancellationToken?: CancellationToken,
): Promise<AgentExecutionResult> {
  const fs = getFileSystem();
  const entry = registry[agentId];
  if (!entry) throw new Error(`Agent '${agentId}' not found in registry`);

  const fullPath = resolveRegistryPath(cwd, entry.path);
  if (!fs.existsSync(fullPath)) throw new Error(`Agent file not found: ${fullPath}`);

  const content = fs.readFileSync(fullPath, 'utf8');
  const model = entry.model ?? parseFrontmatterModel(content);
  let resolvedPrompt = prompt ?? 'Work according to your rules';

  if (previousOutputPath && fs.existsSync(previousOutputPath)) {
    const stateId = path.basename(previousOutputPath, path.extname(previousOutputPath));
    const history = readLatestNRuns(cwd, stateId, useLatest, workflowArg);
    const previous = history ?? fs.readFileSync(previousOutputPath, 'utf8').trim();
    if (previous) resolvedPrompt = `${resolvedPrompt}\n\nYour previous output(s):\n${previous}`;
  }
  if (resolvedPrompt.trim() === '') resolvedPrompt = 'Work according to your rules';

  let client: CopilotClient | undefined;
  let session: CopilotSession | undefined;
  let removeCancellationListener: (() => void) | undefined;
  let cancellationRequested = cancellationToken?.isCancellationRequested === true;
  let originalError: unknown;
  let cancellationPromise: Promise<void> | undefined;
  let resolveCancellation: (() => void) | undefined;
  const cancellation = new Promise<void>((resolve) => {
    resolveCancellation = resolve;
  });

  try {
    try {
      client = new CopilotClient();
    } catch (error) {
      throw describeSdkError('setup', error);
    }
    const sessionConfig: SessionConfig = {
      model,
      agent: agentId,
      customAgents: [{ name: agentId, prompt: agentPrompt(content), model }],
      workingDirectory: cwd,
      onPermissionRequest: approveAll,
    };
    try {
      session = await client.createSession(sessionConfig);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const operation = /auth|login|token|credential/i.test(message)
        ? 'authentication'
        : 'session setup';
      throw describeSdkError(operation, error);
    }

    const cancel = (): void => {
      if (cancellationPromise) return;
      cancellationRequested = true;
      cancellationPromise = Promise.resolve().then(() => {
        if (!session) throw new Error('Copilot SDK session is unavailable');
        return session.abort();
      });
      resolveCancellation?.();
    };
    if (cancellationToken) {
      removeCancellationListener = cancellationToken.onCancellationRequested(cancel);
      if (cancellationToken.isCancellationRequested) cancel();
    }

    if (cancellationRequested) {
      await cancellationPromise?.catch((abortError: unknown) => {
        throw describeSdkError('cancellation', abortError);
      });
      return { success: false, cancelled: true, stdout: '', stderr: '' };
    }

    let response: AssistantMessageEvent | undefined;
    let receivedDelta = false;
    try {
      ({ response, receivedDelta } = await sendAndWaitForIdle(
        session,
        resolvedPrompt,
        cancellation,
      ));
    } catch (error) {
      if (cancellationRequested) {
        await cancellationPromise?.catch((abortError: unknown) => {
          throw describeSdkError('cancellation', abortError);
        });
        return { success: false, cancelled: true, stdout: '', stderr: '' };
      }
      throw describeSdkError('execution', error);
    }
    if (cancellationRequested) {
      await cancellationPromise?.catch((abortError: unknown) => {
        throw describeSdkError('cancellation', abortError);
      });
      return { success: false, cancelled: true, stdout: '', stderr: '' };
    }

    let stdout: string;
    try {
      stdout = extractAssistantContent(response);
    } catch (error) {
      throw describeSdkError('execution', error);
    }
    if (!receivedDelta) process.stdout.write(`${stdout}\n`);
    let metrics;
    try {
      metrics = await session.rpc.usage.getMetrics();
    } catch (error) {
      throw describeSdkError('usage collection', error);
    }
    return { success: true, stdout, stderr: '', tokens: mapUsage(metrics) };
  } catch (error) {
    originalError = error;
    if (error instanceof Error && error.message.startsWith('Copilot SDK ')) throw error;
    throw describeSdkError('execution', error);
  } finally {
    removeCancellationListener?.();
    let cleanupError: unknown;
    if (session) {
      try {
        await session.disconnect();
      } catch (error) {
        cleanupError = describeSdkError('session cleanup', error);
      }
    }
    if (client) {
      try {
        const errors = await client.stop();
        if (errors.length > 0 && !cleanupError)
          cleanupError = describeSdkError('client cleanup', errors[0]);
      } catch (error) {
        if (!cleanupError) cleanupError = describeSdkError('client cleanup', error);
      }
    }
    if (cleanupError && !originalError) throw cleanupError;
  }
}
