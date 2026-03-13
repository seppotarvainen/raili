import { StateDef } from '../types';
import { executeCommand } from '../handlers/commandHandler';
import { saveOutput } from '../outputStore';
import type { StateOutcome } from './Engine';

/**
 * Runs an inline shell command defined in workflow.yaml and returns the outcome string.
 * - If state uses `on:`, exit code determines PASSED / FAILED.
 * - If state uses `transitions:`, last line of stdout is the outcome key.
 * - If output.store is true, appends output to .raili/outputs/<stateId>.md.
 *
 * `directory` is optional — defaults to cwd.
 */
export async function runCommandState(state: StateDef, cwd: string): Promise<StateOutcome> {
  const command = state.config.command!;
  const workdir = state.config.directory ?? cwd;

  const result = await executeCommand(command, workdir);

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
        `State '${state.id}': command produced no output — expected a transition key as last stdout line`
      );
    }
    if (!(lastLine in state.config.transitions)) {
      throw new Error(
        `State '${state.id}': command output '${lastLine}' does not match any key in transitions (${Object.keys(state.config.transitions).join(', ')})`
      );
    }
    return lastLine;
  }

  return result.success ? 'PASSED' : 'FAILED';
}
