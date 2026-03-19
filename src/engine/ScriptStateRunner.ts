import { StateDef } from '../types';
import { ScriptRegistry } from '../scriptRegistry';
import { executeScript } from '../handlers/scriptHandler';
import { saveOutput } from '../outputStore';
import type { StateResult } from './Engine';
import { IStateRunner } from './StateRunner';
import { parseExports } from '../variableExports';

/**
 * ScriptStateRunner - class-based implementation conforming to IStateRunner.
 * Centralizes script-related plumbing (env preparation, output storage, expose parsing).
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

    // Prepare env overrides from current vars
    const envOverrides: Record<string, string> = {};
    if (vars) {
      for (const [k, v] of Object.entries(vars)) {
        envOverrides[`RAILI_VAR_${k.toUpperCase()}`] = v;
      }
    }

    const result = await executeScript(this.registry, scriptId, cwd, args, envOverrides);

    // Store output if configured
    if (state.config.output) {
      const combined = [result.stdout, result.stderr].filter(Boolean).join('\n');
      if (combined) {
        if (typeof workflowArg !== 'undefined') {
          saveOutput(cwd, state.id, combined, state.config.output, workflowArg);
        } else {
          saveOutput(cwd, state.id, combined, state.config.output);
        }
      }
    }

    // Parse exposes if configured (supports `name=value`, `export name=value`, case-insensitive key, and quoted values)
    const exports: Record<string, string> = {};
    if (state.config.expose && state.config.expose.length) {
      const parsed = parseExports(result.stdout, state.config.expose);
      for (const [k, v] of Object.entries(parsed)) {
        exports[k] = v;
      }
    }

    let outcome: string;
    if (state.config.on) {
      outcome = result.success ? 'PASSED' : 'FAILED';
    } else if (state.config.transitions) {
      const lastLine = result.stdout.trimEnd().split('\n').pop()?.trim() ?? '';
      if (!lastLine) {
        throw new Error(
          `State '${state.id}': script produced no output — expected a transition key as last stdout line`,
        );
      }
      outcome = lastLine;
    } else {
      outcome = result.success ? 'PASSED' : 'FAILED';
    }

    return { outcome, exports };
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
