import {spawn} from 'child_process';
import * as path from 'path';
import {getFileSystem} from '../infrastructure/fileSystemProvider';
import {AgentRegistry} from '../registry/agentRegistry';
import {resolveRegistryPath} from '../context/pathUtils';
import {readLatestNRuns} from '../context/outputStore';
import {CancellationToken, TokenUsage} from '../types';
import {parseCopilotTokenLine} from './tokenParser';

interface AgentExecutionResult {
  success: boolean;
  cancelled?: boolean;
  stdout: string;
  stderr: string;
  tokens?: TokenUsage;
}

function parseFrontmatterModel(content: string): string | undefined {
  const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(content);
  if (!match) {
    return undefined;
  }
  const modelLine = match[1].split(/\r?\n/).find((l) => l.startsWith('model:'));
  return modelLine ? modelLine.replace(/^model:\s*/, '').trim() : undefined;
}

function quoteWindowsCommandArg(value: string): string {
  if (value.length === 0) return '""';

  return `"${value
    .replace(/(\\*)"/g, '$1$1\\"')
    .replace(/(\\+)$/g, '$1$1')}"`;
}

export function executeAgent(
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
  if (!entry) {
    throw new Error(`Agent '${agentId}' not found in registry`);
  }

  const fullPath = resolveRegistryPath(cwd, entry.path);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`Agent file not found: ${fullPath}`);
  }

  const content = fs.readFileSync(fullPath, 'utf8');
  const frontmatterModel = parseFrontmatterModel(content);
  const model = entry.model ?? frontmatterModel;

  let resolvedPrompt = prompt ?? 'Work according to your rules';

  if (previousOutputPath && fs.existsSync(previousOutputPath)) {
    // Prefer using the outputStore helper which understands run separators and n-selection

    const stateId = path.basename(previousOutputPath, path.extname(previousOutputPath));
    const history = readLatestNRuns(cwd, stateId, useLatest, workflowArg);
    // If readLatestNRuns returned null (no runs found), fall back to reading the whole file
    const finalHistory = history ?? fs.readFileSync(previousOutputPath, 'utf8').trim();
    if (finalHistory) {
      resolvedPrompt = `${resolvedPrompt}\n\nYour previous output(s):\n${finalHistory}`;
    }
  }

  // Ensure resolvedPrompt is never an empty string. Use default fallback when trimmed blank.
  if (!resolvedPrompt || resolvedPrompt.toString().trim() === '') {
    resolvedPrompt = 'Work according to your rules';
  }

  const args = [`--agent=${agentId}`, '--prompt', resolvedPrompt, '--yolo'];
  if (model) {
    args.splice(1, 0, `--model=${model}`);
  }

  return new Promise((resolve, reject) => {
    const isWindows = process.platform === 'win32';
    const copilotCommand = isWindows ? 'copilot.cmd' : 'copilot';
    const command = isWindows ? process.env.ComSpec ?? 'cmd.exe' : copilotCommand;
    const commandArgs = isWindows
      ? [
          '/d',
          '/s',
          '/c',
          [copilotCommand, ...args.map(quoteWindowsCommandArg)].join(' '),
        ]
      : args;
    const child = spawn(command, commandArgs, {
      cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsVerbatimArguments: isWindows,
    });

    let stdout = '';
    let stderr = '';
    let settled = false;
    let cancellationRequested = false;
    let terminationRequested = false;
    let removeCancellationListener: (() => void) | undefined;

    child.on('error', (error: NodeJS.ErrnoException) => {
      if (settled) return;
      settled = true;
      removeCancellationListener?.();

      if (error.code === 'ENOENT') {
        reject(
          new Error(
            `Copilot CLI could not be launched. Ensure ${copilotCommand} is installed and available on PATH.`,
          ),
        );
        return;
      }

      reject(error);
    });

    const finish = (cancelled: boolean, code: number | null = null): void => {
      if (settled) return;
      settled = true;
      removeCancellationListener?.();
      const tokens = parseCopilotTokenLine(stdout) ?? parseCopilotTokenLine(stderr);
      const result: AgentExecutionResult = {
        success: cancelled ? false : code === 0,
        stdout,
        stderr,
      };
      if (cancelled) result.cancelled = true;
      if (tokens) result.tokens = tokens;
      resolve(result);
    };

    const cancel = (): void => {
      cancellationRequested = true;
      if (!terminationRequested) {
        terminationRequested = true;
        child.kill();
      }
      finish(true);
    };

    child.stdout.on('data', (chunk: Buffer) => {
      const text = chunk.toString();
      process.stdout.write(text); // stream live
      stdout += text;
    });

    child.stderr.on('data', (chunk: Buffer) => {
      const text = chunk.toString();
      process.stderr.write(text); // stream live
      stderr += text;
    });

    child.on('close', (code) => {
      finish(cancellationRequested || cancellationToken?.isCancellationRequested === true, code);
    });

    if (cancellationToken) {
      const unsubscribe = cancellationToken.onCancellationRequested(cancel);
      removeCancellationListener = settled ? undefined : unsubscribe;
      if (settled) unsubscribe();
      if (cancellationToken.isCancellationRequested) cancel();
    }
  });
}

// New handler alias to conform to a "handler" naming convention used by abstractions
const executeAgentHandler = executeAgent;
