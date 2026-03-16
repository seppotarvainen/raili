import { StateDef } from '../types';
import { ScriptRegistry } from '../scriptRegistry';
import { executeScript } from '../handlers/scriptHandler';
import { saveOutput } from '../outputStore';
import type { StateOutcome } from './Engine';

/**
 * Runs a script state and returns the outcome string.
 * - If state uses `on:`, success flag determines PASSED / FAILED.
 * - If state uses `transitions:`, last line of stdout is the outcome key.
 * - If output.store is true, appends output to .raili/outputs/<stateId>.md.
 */
export async function runScriptState(state: StateDef, registry: ScriptRegistry, cwd: string): Promise<StateOutcome> {
  const scriptId = state.config.script!;
  const result = await executeScript(registry, scriptId, cwd);

  // Store output if configured
  if (state.config.output) {
    const combined = [result.stdout, result.stderr].filter(Boolean).join('\n');
    if (combined) saveOutput(cwd, state.id, combined, state.config.output);
  }

  if (state.config.on) {
    return result.success ? 'PASSED' : 'FAILED';
  }

  if (state.config.transitions) {
    const lastLine = result.stdout.trimEnd().split('\n').pop()?.trim() ?? '';
    if (!lastLine) {
      throw new Error(
        `State '${state.id}': script produced no output — expected a transition key as last stdout line`
      );
    }
    return lastLine;
  }

  return result.success ? 'PASSED' : 'FAILED';
}
