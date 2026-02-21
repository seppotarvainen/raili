import { ScriptRegistry } from '../scriptRegistry';

export type ScriptExecutionResult = { success: boolean; output: string };

export function executeScript(registry: ScriptRegistry, scriptId: string, cwd: string): ScriptExecutionResult {
  const entry = registry[scriptId];
  if (!entry) throw new Error(`Script '${scriptId}' not found in registry`);

  const fs = require('fs');
  const path = require('path');
  const fullPath = path.resolve(cwd, entry.path);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`Script file not found: ${fullPath}`);
  }

  // Mocked execution: return file size and name as deterministic output
  const stats = fs.statSync(fullPath);
  return { success: true, output: `MOCKED_SCRIPT_OUTPUT: ${path.basename(fullPath)} size=${stats.size}` };
}
