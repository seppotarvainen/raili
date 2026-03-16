import { StateDef } from '../types';
import { executeCommand } from '../handlers/commandHandler';
import { saveOutput } from '../outputStore';
import type { StateResult } from './Engine';
import { IStateRunner } from './StateRunner';

/**
 * CommandStateRunner - class-based implementation conforming to IStateRunner.
 * Handles inline shell command execution plumbing.
 */
export class CommandStateRunner implements IStateRunner {
  constructor() {}

  async run(state: StateDef, cwd: string, vars?: Record<string,string>): Promise<StateResult> {
    const command = state.config.command!;
    const workdir = state.config.directory ?? cwd;

    // Prepare env overrides from current vars
    const envOverrides: Record<string,string> = {};
    if (vars) {
      for (const [k,v] of Object.entries(vars)) {
        envOverrides[`RAILI_VAR_${k.toUpperCase()}`] = v;
      }
    }

    const result = await executeCommand(command, workdir, envOverrides);

    // Store output if configured
    if (state.config.output) {
      const combined = [result.stdout, result.stderr].filter(Boolean).join('\n');
      if (combined) saveOutput(cwd, state.id, combined, state.config.output);
    }

    // Parse exposes if configured
    const exports: Record<string,string> = {};
    if (state.config.expose && state.config.expose.length) {
      for (const name of state.config.expose) {
        const re = new RegExp(`^${name}=(.*)$`, 'm');
        const m = result.stdout.match(re);
        if (m && m[1] !== undefined) {
          exports[name] = m[1];
        }
      }
    }

    let outcome: string;
    if (state.config.on) {
      outcome = result.success ? 'PASSED' : 'FAILED';
    } else if (state.config.transitions) {
      const lastLine = result.stdout.trimEnd().split('\n').pop()?.trim() ?? '';
      if (!lastLine) {
        throw new Error(
          `State '${state.id}': command produced no output — expected a transition key as last stdout line`
        );
      }
      outcome = lastLine;
    } else {
      outcome = result.success ? 'PASSED' : 'FAILED';
    }

    return { outcome, exports };
  }
}

// Backwards-compatible helper
export async function runCommandState(state: StateDef, cwd: string, vars?: Record<string,string>): Promise<StateResult> {
  const runner = new CommandStateRunner();
  return runner.run(state, cwd, vars);
}
