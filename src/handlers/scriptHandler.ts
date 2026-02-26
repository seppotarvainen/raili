import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { ScriptRegistry } from '../scriptRegistry';

export type ScriptExecutionResult = { success: boolean; output: string };

export function executeScript(registry: ScriptRegistry, scriptId: string, cwd: string): Promise<ScriptExecutionResult> {
  const entry = registry[scriptId];
  if (!entry) throw new Error(`Script '${scriptId}' not found in registry`);

  const fullPath = path.resolve(cwd, entry.path);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`Script file not found: ${fullPath}`);
  }

  return new Promise((resolve) => {
    const child = spawn('sh', [fullPath], { cwd, stdio: ['ignore', 'pipe', 'pipe'] });

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
      const success = code === 0;
      resolve({ success, output: success ? stdout : stderr || stdout });
    });
  });
}
