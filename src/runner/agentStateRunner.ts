import { StateDef } from '../types';
import { AgentRegistry } from '../registry/agentRegistry';
import { executeAgent } from '../handlers/agentHandler';
import { loadAgentOutputPath, readLatestRun } from '../context/outputStore';
import { storeOutput } from './stateRunnerUtils';
import { interpolateString } from '../variables/variableInterpolation';
import type { StateResult } from './runner';
import { IStateRunner } from './stateRunner';
import { readLearningsForPrompt } from '../context/learningStore';

/**
 * AgentStateRunner - prototype implementation of the StateRunner interface
 * Encapsulates agent-specific execution plumbing. Kept as a class to make
 * it easy to share helper methods and to demonstrate the abstraction.
 */
class AgentStateRunner implements IStateRunner {
  constructor(private registry: AgentRegistry) {}

  async run(
    state: StateDef,
    cwd: string,
    vars?: Record<string, string>,
    workflowArg?: string,
  ): Promise<StateResult> {
    // Step 1: load previous output path for this state (may be null)
    const previousOutputPath = loadAgentOutputPath(cwd, state.id, workflowArg);

    const agentId = state.config.agent!;

    // Interpolate the prompt with variables from vars (YAML semantics: missing -> empty string)
    let interpolatedPrompt = state.config.prompt;
    if (interpolatedPrompt && vars) {
      interpolatedPrompt = interpolateString(interpolatedPrompt, vars, {
        throwOnMissing: false,
        missingValue: '',
      });
    }

    // Load cleaned learnings (timestamps removed) and inject into prompt if present
    // Note: when the learningStore module is mocked in tests the mocked function may return
    // undefined; coerce to empty string to avoid runtime errors in tests.
    const rawLearnings = readLearningsForPrompt(cwd, agentId, workflowArg) || '';
    const fullLearnings = String(rawLearnings).trim();
    // Do not inject a default instructional prompt. If no prompt is defined, pass undefined so
    // handlers can decide how to behave. Only prepend learnings when an explicit prompt exists.
    let assembledPrompt = interpolatedPrompt ?? undefined;
    if (fullLearnings && assembledPrompt) {
      const learningsIntro =
        '## Learnings from previous runs\n' +
        'The following are lessons learned from previous workflow runs.\n' +
        'You MUST apply these lessons. Violating them is considered a failure.\n';

      assembledPrompt = `${learningsIntro}\n${fullLearnings}\n---\n\n## Current prompt\n\n${assembledPrompt}`;
    }

    const useLatest = state.config.output?.use_latest;
    const result = await executeAgent(
      this.registry,
      agentId,
      cwd,
      previousOutputPath,
      assembledPrompt,
      useLatest,
      workflowArg,
    );

    // Store output if configured (delegated to shared helper which also saves latest)
    storeOutput(cwd, state, result, workflowArg);

    if (state.config.on) {
      return { outcome: result.success ? 'PASSED' : 'FAILED' };
    }

    if (state.config.transitions) {
      const lastLine = result.stdout.trimEnd().split('\n').pop()?.trim() ?? '';
      if (!lastLine) {
        throw new Error(
          `State '${state.id}': agent produced no output — expected a transition key as last stdout line`,
        );
      }
      return { outcome: lastLine };
    }

    return { outcome: result.success ? 'PASSED' : 'FAILED' };
  }
}

// Backwards-compatible helper exported as before
export async function runAgentState(
  state: StateDef,
  registry: AgentRegistry,
  cwd: string,
  vars?: Record<string, string>,
  workflowArg?: string,
): Promise<StateResult> {
  const runner = new AgentStateRunner(registry);
  return runner.run(state, cwd, vars, workflowArg);
}
