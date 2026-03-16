import { StateDef, WorkflowContext } from '../types';
import { AgentRegistry } from '../agentRegistry';
import { executeAgent } from '../handlers/agentHandler';
import { saveOutput, loadAgentOutputPath } from '../outputStore';
import { interpolateString } from '../variableInterpolation';
import type { StateResult } from './Engine';


/**
 * Runs an agent state and returns the outcome string.
 * - Loads previous output path and passes it to the agent via RAILI_AGENT_CONTEXT env var
 * - Stores output to .raili/outputs/<stateId>.md if output.store is true
 * - Interpolates prompt with variables from vars
 * Note: reset_outputs is handled by the Engine on state entry, before this is called.
 */
export async function runAgentState(state: StateDef, registry: AgentRegistry, cwd: string, vars?: Record<string, string>): Promise<StateResult> {
  // Step 1: load previous output path for this state (may be null)
  const previousOutputPath = loadAgentOutputPath(cwd, state.id);

  const agentId = state.config.agent!;

  // Interpolate the prompt with variables from vars
  let interpolatedPrompt = state.config.prompt;
  if (interpolatedPrompt && vars) {
    interpolatedPrompt = interpolateString(interpolatedPrompt, vars);
  }

  const result = await executeAgent(registry, agentId, cwd, previousOutputPath, interpolatedPrompt);

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
