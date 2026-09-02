/// <reference path="../../types/copilot-sdk.d.ts" />
import path from 'path';
import { loadAgentRegistry } from '../../../src/registry/agentRegistry';
import { executeAgent } from '../../../src/handlers/agentHandler';
import { setupFakeFs } from '../infrastructure/fsFake.util';
import { getFileSystem } from '../../../src/infrastructure/fileSystemProvider';
import { CancellationController } from '../../../src/types';
import {
  CopilotClient,
  approveAll,
  mockClient,
  mockSession,
  resetCopilotSdkMock,
} from '@github/copilot-sdk';

jest.mock('@github/copilot-sdk');

const TMP = '/tmp';
let restoreFs: () => void;

beforeEach(() => {
  jest.clearAllMocks();
  resetCopilotSdkMock();
  restoreFs = setupFakeFs();
});

afterEach(() => restoreFs());

function setupAgent(model?: string, frontmatterModel?: string) {
  const fs = getFileSystem();
  const agentDir = path.join(TMP, '.raili');
  fs.mkdirSync(path.join(agentDir, 'main', 'outputs'), { recursive: true });
  const agentFile = path.join(TMP, 'agents', 'analyzer.agent.md');
  fs.mkdirSync(path.dirname(agentFile), { recursive: true });
  const frontmatter = frontmatterModel ? `---\nmodel: ${frontmatterModel}\n---\n` : '';
  fs.writeFileSync(agentFile, `${frontmatter}Agent instructions here`);
  const entry: { path: string; model?: string } = { path: './agents/analyzer.agent.md' };
  if (model) entry.model = model;
  fs.writeFileSync(
    path.join(agentDir, 'agent-registry.json'),
    JSON.stringify({ 'analyzer.agent': entry }),
  );
  return loadAgentRegistry(TMP);
}

test('creates an SDK session with the configured agent, model, prompt, and permissions', async () => {
  const registry = setupAgent('gpt-5.1');
  await executeAgent(registry, 'analyzer.agent', TMP, null, 'Analyze this');

  expect(CopilotClient).toHaveBeenCalledTimes(1);
  expect(mockClient.createSession).toHaveBeenCalledWith(
    expect.objectContaining({
      agent: 'analyzer.agent',
      model: 'gpt-5.1',
      workingDirectory: TMP,
      onPermissionRequest: approveAll,
      customAgents: [
        {
          name: 'analyzer.agent',
          model: 'gpt-5.1',
          prompt: 'Agent instructions here',
        },
      ],
    }),
  );
  expect(mockSession.sendAndWait).toHaveBeenCalledWith({ prompt: 'Analyze this' });
  expect(await approveAll({} as never, { sessionId: 'test-session' })).toEqual({
    kind: 'approve-once',
  });
  expect(mockSession.disconnect).toHaveBeenCalled();
  expect(mockClient.stop).toHaveBeenCalled();
});

test('uses frontmatter model when the registry does not override it', async () => {
  const registry = setupAgent(undefined, 'claude-sonnet-4.6');
  await executeAgent(registry, 'analyzer.agent', TMP);
  expect(mockClient.createSession.mock.calls[0][0].model).toBe('claude-sonnet-4.6');
});

test('assembles previous output into a custom prompt and returns assistant content', async () => {
  const registry = setupAgent();
  const previous = path.join(TMP, '.raili', 'main', 'outputs', 'previous.md');
  getFileSystem().writeFileSync(previous, 'I already did X');

  const result = await executeAgent(registry, 'analyzer.agent', TMP, previous, 'Do the thing');

  expect(mockSession.sendAndWait.mock.calls[0][0].prompt).toContain('Do the thing');
  expect(mockSession.sendAndWait.mock.calls[0][0].prompt).toContain('I already did X');
  expect(result).toMatchObject({ success: true, stdout: 'agent output', stderr: '' });
});

test('prints the completed assistant content when the SDK does not emit deltas', async () => {
  const write = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
  const registry = setupAgent();

  await executeAgent(registry, 'analyzer.agent', TMP);

  expect(write).toHaveBeenCalledWith('agent output\n');
  write.mockRestore();
});

test('maps SDK usage including the formatted AI Credits display', async () => {
  const registry = setupAgent();
  const result = await executeAgent(registry, 'analyzer.agent', TMP);

  expect(result.tokens).toMatchObject({
    input: 12,
    cached: -1,
    output: 7,
    ai_credits: 2,
    ai_time: 2,
    ai_display: 'AI Credits 2 (2s)',
  });
});

test('aggregates per-model SDK usage instead of retaining only the last call', async () => {
  mockSession.rpc.usage.getMetrics.mockResolvedValueOnce({
    totalPremiumRequestCost: 0,
    totalUserRequests: 2,
    totalApiDurationMs: 1000,
    sessionStartTime: new Date(0).toISOString(),
    codeChanges: { linesAdded: 0, linesRemoved: 0, filesModifiedCount: 0, filesModified: [] },
    modelMetrics: {
      'model-a': {
        requests: { count: 1, cost: 0 },
        usage: { inputTokens: 20, outputTokens: 4, cacheReadTokens: 3, cacheWriteTokens: 0 },
      },
      'model-b': {
        requests: { count: 1, cost: 0 },
        usage: { inputTokens: 30, outputTokens: 6, cacheReadTokens: 5, cacheWriteTokens: 0 },
      },
    },
    totalNanoAiu: 1000000000,
    lastCallInputTokens: 30,
    lastCallOutputTokens: 6,
  });
  const registry = setupAgent();

  const result = await executeAgent(registry, 'analyzer.agent', TMP);

  expect(result.tokens).toMatchObject({ input: 50, cached: 8, output: 10 });
});

test('fails on an absent assistant response and still cleans up', async () => {
  mockSession.sendAndWait.mockResolvedValueOnce(undefined);
  const registry = setupAgent();

  await expect(executeAgent(registry, 'analyzer.agent', TMP)).rejects.toThrow(
    'Copilot SDK execution failed: Copilot SDK returned no assistant content',
  );
  expect(mockSession.disconnect).toHaveBeenCalled();
  expect(mockClient.stop).toHaveBeenCalled();
});

test('surfaces authentication failures from session setup', async () => {
  mockClient.createSession.mockRejectedValueOnce(new Error('login required'));
  const registry = setupAgent();

  await expect(executeAgent(registry, 'analyzer.agent', TMP)).rejects.toThrow(
    'Copilot SDK authentication failed: login required',
  );
});

test('surfaces usage collection failures', async () => {
  mockSession.rpc.usage.getMetrics.mockRejectedValueOnce(new Error('metrics unavailable'));
  const registry = setupAgent();

  await expect(executeAgent(registry, 'analyzer.agent', TMP)).rejects.toThrow(
    'Copilot SDK usage collection failed: metrics unavailable',
  );
});

test('surfaces cleanup failures when execution otherwise succeeds', async () => {
  mockSession.disconnect.mockRejectedValueOnce(new Error('disconnect failed'));
  const registry = setupAgent();

  await expect(executeAgent(registry, 'analyzer.agent', TMP)).rejects.toThrow(
    'Copilot SDK session cleanup failed: disconnect failed',
  );
  expect(mockClient.stop).toHaveBeenCalled();
});

test('aborts and returns cancellation when cancellation is requested in flight', async () => {
  const registry = setupAgent();
  let resolveResponse: ((value: undefined) => void) | undefined;
  mockSession.sendAndWait.mockReturnValueOnce(
    new Promise((resolve) => {
      resolveResponse = resolve;
    }),
  );
  let listener: (() => void) | undefined;
  let requested = false;
  const cancellation: CancellationController = {
    get isCancellationRequested() {
      return requested;
    },
    onCancellationRequested(callback) {
      listener = callback;
      return () => {
        listener = undefined;
      };
    },
    requestCancellation() {
      requested = true;
      listener?.();
      resolveResponse?.(undefined);
    },
  };

  const resultPromise = executeAgent(
    registry,
    'analyzer.agent',
    TMP,
    null,
    undefined,
    null,
    undefined,
    cancellation,
  );
  await Promise.resolve();
  cancellation.requestCancellation();

  await expect(resultPromise).resolves.toMatchObject({ success: false, cancelled: true });
  expect(mockSession.abort).toHaveBeenCalledTimes(1);
});

test('throws when the agent is not in the registry', async () => {
  const registry = setupAgent();
  await expect(executeAgent(registry, 'missing.agent', TMP)).rejects.toThrow(
    "Agent 'missing.agent' not found in registry",
  );
});
