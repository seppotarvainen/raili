import { spawnSync } from 'child_process';
import { StateDef } from '../types';
import type { StateOutcome } from './Engine';

/**
 * Runs an inline shell command defined in workflow.yaml and returns the outcome string.
 * - If state uses `on:`, exit code determines PASSED / FAILED.
 * - If state uses `transitions:`, last line of stdout is the outcome key.
 *
 * The command is executed via `sh -c` so pipes, redirects, etc. all work.
 * `directory` is optional — defaults to cwd.
 */
export function runCommandState(state: StateDef, cwd: string): StateOutcome {
  const command = state.config.command!;
  const workdir = state.config.directory ?? cwd;

  const result = spawnSync('sh', ['-c', command], {
    cwd: workdir,
    encoding: 'utf8',
  });

  const output = result.stdout ?? '';
  const success = result.status === 0 && !result.error;

  if (state.config.on) {
    return success ? 'PASSED' : 'FAILED';
  }

  if (state.config.transitions) {
    const lastLine = output.trimEnd().split('\n').pop()?.trim() ?? '';
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

  return success ? 'PASSED' : 'FAILED';
}

