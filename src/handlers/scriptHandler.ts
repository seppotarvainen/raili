import { spawn } from 'child_process';
import { getFileSystem } from '../infrastructure/fileSystemProvider';
import { ScriptRegistry } from '../registry/scriptRegistry';
import { resolveRegistryPath } from '../context/pathUtils';
import { CancellationToken } from '../types';

interface ScriptExecutionResult {
  success: boolean;
  cancelled?: boolean;
  stdout: string;
  stderr: string;
}

export function executeScript(
  registry: ScriptRegistry,
  scriptId: string,
  cwd: string,
  args: string[] = [],
  envOverrides: Record<string, string> = {},
  cancellationToken?: CancellationToken,
): Promise<ScriptExecutionResult> {
  const fs = getFileSystem();
  const entry = registry[scriptId];
  if (!entry) {
    throw new Error(`Script '${scriptId}' not found in registry`);
  }

  const fullPath = resolveRegistryPath(cwd, entry.path);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`Script file not found: ${fullPath}`);
  }

  return new Promise((resolve) => {
    const child = spawn(fullPath, args, {
      cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, ...envOverrides },
    });

    let stdout = '';
    let stderr = '';
    let settled = false;
    let cancellationRequested = false;
    let terminationRequested = false;
    let removeCancellationListener: (() => void) | undefined;

    const finish = (cancelled: boolean, code: number | null = null): void => {
      if (settled) return;
      settled = true;
      removeCancellationListener?.();
      const result: ScriptExecutionResult = {
        success: cancelled ? false : code === 0,
        stdout,
        stderr,
      };
      if (cancelled) result.cancelled = true;
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
      process.stdout.write(text);
      stdout += text;
    });

    child.stderr.on('data', (chunk: Buffer) => {
      const text = chunk.toString();
      process.stderr.write(text);
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
const executeScriptHandler = executeScript;
