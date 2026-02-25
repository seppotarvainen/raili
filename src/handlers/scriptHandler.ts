import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { ScriptRegistry } from '../scriptRegistry';

export type ScriptExecutionResult = { success: boolean; output: string };

export function executeScript(registry: ScriptRegistry, scriptId: string, cwd: string): ScriptExecutionResult {
  const entry = registry[scriptId];
  if (!entry) throw new Error(`Script '${scriptId}' not found in registry`);

  const fullPath = path.resolve(cwd, entry.path);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`Script file not found: ${fullPath}`);
  }

  const result = spawnSync('sh', [fullPath], { cwd, encoding: 'utf8' });

  const output = result.stdout ?? '';
  const stderr = result.stderr ?? '';
  const success = result.status === 0 && !result.error;

  return { success, output: success ? output : stderr || output };
}
