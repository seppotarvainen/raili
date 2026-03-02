import {spawn} from 'child_process';
import fs from 'fs';
import {ScriptRegistry} from '../scriptRegistry';
import {resolveRegistryPath} from '../pathUtils';

export type ScriptExecutionResult = { success: boolean; stdout: string; stderr: string };

export function executeScript(registry: ScriptRegistry, scriptId: string, cwd: string): Promise<ScriptExecutionResult> {
  const entry = registry[scriptId];
  if (!entry) throw new Error(`Script '${scriptId}' not found in registry`);

  const fullPath = resolveRegistryPath(cwd, entry.path);
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
      resolve({ success: code === 0, stdout, stderr });
    });
  });
}
