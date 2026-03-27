import { spawn } from 'child_process';
import fs from 'fs';
import { ScriptRegistry } from '../registry/scriptRegistry';
import { resolveRegistryPath } from '../context/pathUtils';

interface ScriptExecutionResult {
  success: boolean;
  stdout: string;
  stderr: string;
}

export function executeScript(
  registry: ScriptRegistry,
  scriptId: string,
  cwd: string,
  args: string[] = [],
  envOverrides: Record<string, string> = {},
): Promise<ScriptExecutionResult> {
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
      resolve({ success: code === 0, stdout, stderr });
    });
  });
}

// New handler alias to conform to a "handler" naming convention used by abstractions
const executeScriptHandler = executeScript;
