import { StateDef } from '../types';
import { ScriptRegistry } from '../scriptRegistry';
import { executeScript } from '../handlers/scriptHandler';
import type { StateOutcome } from './Engine';


/**
 * Runs a script state and returns the outcome string.
 * - If state uses `on:`, success flag determines PASSED / FAILED.
 * - If state uses `transitions:`, last line of stdout is the outcome key.
 */
export function runScriptState(state: StateDef, registry: ScriptRegistry, cwd: string): StateOutcome {
  const scriptId = state.config.script!;
  const result = executeScript(registry, scriptId, cwd);

  if (state.config.on) {
    return result.success ? 'PASSED' : 'FAILED';
  }

  if (state.config.transitions) {
    const lastLine = result.output.trimEnd().split('\n').pop()?.trim() ?? '';
    if (!lastLine) {
      throw new Error(
        `State '${state.id}': script produced no output — expected a transition key as last stdout line`
      );
    }
    if (!(lastLine in state.config.transitions)) {
      throw new Error(
        `State '${state.id}': script output '${lastLine}' does not match any key in transitions (${Object.keys(state.config.transitions).join(', ')})`
      );
    }
    return lastLine;
  }

  return result.success ? 'PASSED' : 'FAILED';
}

