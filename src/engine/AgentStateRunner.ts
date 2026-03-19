import { StateDef, LearnSource } from '../types';
import { AgentRegistry } from '../agentRegistry';
import { executeAgent } from '../handlers/agentHandler';
import { saveOutput, loadAgentOutputPath, readLatestRun } from '../outputStore';
import { interpolateString } from '../variableInterpolation';
import type { StateResult } from './Engine';
import { IStateRunner } from './StateRunner';
import { readLearnings, appendUniqueLearning } from '../learningStore';

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

    // Process learn_from sources if declared. Gather sources and append unique learnings.
    if (state.config.learn_from && state.config.learn_from.length > 0) {
      for (const src of state.config.learn_from as LearnSource[]) {
        try {
          if ((src as any).output) {
            const fromState = (src as any).output as string;
            const latest = readLatestRun(cwd, fromState, workflowArg);
            if (latest && latest.trim()) {
              // Compress to single-line summary
              const oneLine = latest.replace(/\s+/g, ' ').trim();
              appendUniqueLearning(cwd, agentId, `output:${fromState}`, oneLine, workflowArg);
            }
          } else if ((src as any).var) {
            const varPattern = /^\$\{([A-Za-z_][A-Za-z0-9_]*)\}$/;
            const raw = (src as any).var as string;
            const m = varPattern.exec(raw);
            if (m) {
              const varName = m[1];
              const value = vars?.[varName];
              if (value && value.trim()) {
                const oneLine = value.replace(/\s+/g, ' ').trim();
                appendUniqueLearning(cwd, agentId, `var:${varName}`, oneLine, workflowArg);
              }
            }
          }
        } catch (e) {
          // Per spec: missing/empty sources are skipped silently. Only validation at load-time should fail fast.
          // Here, skip any runtime read errors.
        }
      }
    }

    // Load full learnings and inject into prompt if present
    const fullLearnings = readLearnings(cwd, agentId, workflowArg).trim();
    // Do not inject a default instructional prompt. If no prompt is defined, pass undefined so
    // handlers can decide how to behave. Only prepend learnings when an explicit prompt exists.
    let assembledPrompt = interpolatedPrompt ?? undefined;
    if (fullLearnings && assembledPrompt) {
      assembledPrompt = `${assembledPrompt}\n\n## Learnings from previous runs\n${fullLearnings}`;
    }

    const result = await executeAgent(
      this.registry,
      agentId,
      cwd,
      previousOutputPath,
      assembledPrompt,
    );

    // Store output if configured
    if (state.config.output) {
      const combined = [result.stdout, result.stderr].filter(Boolean).join('\n');
      if (combined) saveOutput(cwd, state.id, combined, state.config.output, workflowArg);
    }

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
