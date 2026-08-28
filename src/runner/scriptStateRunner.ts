import { CancellationToken, StateDef } from '../types';
import { ScriptRegistry } from '../registry/scriptRegistry';
import { executeScript } from '../handlers/scriptHandler';
import type { StateResult } from './runner';
import { IStateRunner } from './stateRunner';
import { buildEnvOverrides, processStateResult } from './stateRunnerUtils';
import { interpolateObject } from '../variables/variableInterpolation';

/**
 * ScriptStateRunner - executes registered scripts via script-registry.
 * Entries may specify a runtime (for example, `node` or `python`) for
 * cross-platform script execution.
 */
class ScriptStateRunner implements IStateRunner {
  constructor(private readonly registry: ScriptRegistry) {}

  async run(
    state: StateDef,
    cwd: string,
    vars?: Record<string, string>,
    workflowArg?: string,
    cancellationToken?: CancellationToken,
  ): Promise<StateResult> {
    const scriptId = state.config.script!;
    const rawArgs = state.config.args ?? [];
    // Interpolate args using workflow vars. Fail-fast on missing variables.
    const args = interpolateObject(rawArgs, vars ?? {}, { throwOnMissing: true }) as string[];
    const envOverrides = buildEnvOverrides(vars);

    const result = cancellationToken
      ? await executeScript(this.registry, scriptId, cwd, args, envOverrides, cancellationToken)
      : await executeScript(this.registry, scriptId, cwd, args, envOverrides);

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
  cancellationToken?: CancellationToken,
): Promise<StateResult> {
  const runner = new ScriptStateRunner(registry);
  return runner.run(state, cwd, vars, workflowArg, cancellationToken);
}
