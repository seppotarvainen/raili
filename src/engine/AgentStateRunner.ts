import { StateDef } from '../types';
import { AgentRegistry } from '../agentRegistry';
import { executeAgent } from '../handlers/agentHandler';
import type { StateOutcome } from './Engine';


/**
 * Runs an agent state and returns the outcome string.
 * - If state uses `on:`, exit code determines PASSED / FAILED.
 * - If state uses `transitions:`, last line of stdout is the outcome key.
 */
export async function runAgentState(state: StateDef, registry: AgentRegistry, cwd: string): Promise<StateOutcome> {
  const agentId = state.config.agent!;
  const result = await executeAgent(registry, agentId, cwd);

  if (state.config.on) {
    return result.success ? 'PASSED' : 'FAILED';
  }

  if (state.config.transitions) {
    const lastLine = result.output.trimEnd().split('\n').pop()?.trim() ?? '';
    if (!lastLine) {
      throw new Error(
        `State '${state.id}': agent produced no output — expected a transition key as last stdout line`
      );
    }
    if (!(lastLine in state.config.transitions)) {
      throw new Error(
        `State '${state.id}': agent output '${lastLine}' does not match any key in transitions (${Object.keys(state.config.transitions).join(', ')})`
      );
    }
    return lastLine;
  }

  // Terminal state or state with no routing — treat success as PASSED
  return result.success ? 'PASSED' : 'FAILED';
}

