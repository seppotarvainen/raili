import { StateDef } from '../types';
import { AgentRegistry } from '../agentRegistry';
import { executeAgent } from '../handlers/agentHandler';
import { saveOutput, loadAgentOutputPath } from '../outputStore';
import { interpolateString } from '../variableInterpolation';
import type { StateResult } from './Engine';
import { IStateRunner } from './StateRunner';

/**
 * AgentStateRunner - prototype implementation of the StateRunner interface
 * Encapsulates agent-specific execution plumbing. Kept as a class to make
 * it easy to share helper methods and to demonstrate the abstraction.
 */
export class AgentStateRunner implements IStateRunner {
  constructor(private registry: AgentRegistry) {}

  async run(state: StateDef, cwd: string, vars?: Record<string, string>): Promise<StateResult> {
    // Step 1: load previous output path for this state (may be null)
    const previousOutputPath = loadAgentOutputPath(cwd, state.id);

    const agentId = state.config.agent!;

    // Interpolate the prompt with variables from vars (YAML semantics: missing -> empty string)
    let interpolatedPrompt = state.config.prompt;
    if (interpolatedPrompt && vars) {
      interpolatedPrompt = interpolateString(interpolatedPrompt, vars, { throwOnMissing: false, missingValue: '' });
    }

    const result = await executeAgent(this.registry, agentId, cwd, previousOutputPath, interpolatedPrompt);

    // Store output if configured
    if (state.config.output) {
      const combined = [result.stdout, result.stderr].filter(Boolean).join('\n');
      if (combined) saveOutput(cwd, state.id, combined, state.config.output);
    }

    if (state.config.on) {
      return { outcome: result.success ? 'PASSED' : 'FAILED' };
    }

    if (state.config.transitions) {
      const lastLine = result.stdout.trimEnd().split('\n').pop()?.trim() ?? '';
      if (!lastLine) {
        throw new Error(
          `State '${state.id}': agent produced no output — expected a transition key as last stdout line`
        );
      }
      return { outcome: lastLine };
    }

    return { outcome: result.success ? 'PASSED' : 'FAILED' };
  }
}

// Backwards-compatible helper exported as before
export async function runAgentState(state: StateDef, registry: AgentRegistry, cwd: string, vars?: Record<string, string>): Promise<StateResult> {
  const runner = new AgentStateRunner(registry);
  return runner.run(state, cwd, vars);
}
