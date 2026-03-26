import { StateDef } from '../types';
import { ScriptRegistry } from '../registry/scriptRegistry';
import { executeScript } from '../handlers/scriptHandler';
import type { StateResult } from './runner';
import { IStateRunner } from './stateRunner';
import { buildEnvOverrides, processStateResult } from './stateRunnerUtils';

/**
 * ScriptStateRunner - executes shell scripts via script-registry.
 */
class ScriptStateRunner implements IStateRunner {
  constructor(private registry: ScriptRegistry) {}

  async run(
    state: StateDef,
    cwd: string,
    vars?: Record<string, string>,
    workflowArg?: string,
  ): Promise<StateResult> {
    const scriptId = state.config.script!;
    const args = state.config.args ?? [];
    const envOverrides = buildEnvOverrides(vars);

    const result = await executeScript(this.registry, scriptId, cwd, args, envOverrides);

    return processStateResult(cwd, state, result, 'script', workflowArg);
  }
}

// Backwards-compatible helper exported as before
export async function runScriptState(
  state: StateDef,
  registry: ScriptRegistry,
  cwd: string,
  vars?: Record<string, string>,
  workflowArg?: string,
): Promise<StateResult> {
  const runner = new ScriptStateRunner(registry);
  return runner.run(state, cwd, vars, workflowArg);
}
