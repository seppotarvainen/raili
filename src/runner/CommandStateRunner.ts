import { StateDef } from '../types';
import { executeCommand } from '../handlers/commandHandler';
import type { StateResult } from './Runner';
import { IStateRunner } from './StateRunner';
import { buildEnvOverrides, processStateResult } from './stateRunnerUtils';

/**
 * CommandStateRunner - executes inline shell commands.
 */
class CommandStateRunner implements IStateRunner {
  constructor() {}

  async run(
    state: StateDef,
    cwd: string,
    vars?: Record<string, string>,
    workflowArg?: string,
  ): Promise<StateResult> {
    const command = state.config.command!;
    const workdir = state.config.directory ?? cwd;
    const envOverrides = buildEnvOverrides(vars);

    const result = await executeCommand(command, workdir, envOverrides);

    return processStateResult(cwd, state, result, 'command', workflowArg);
  }
}

// Backwards-compatible helper
export async function runCommandState(
  state: StateDef,
  cwd: string,
  vars?: Record<string, string>,
  workflowArg?: string,
): Promise<StateResult> {
  const runner = new CommandStateRunner();
  return runner.run(state, cwd, vars, workflowArg);
}
