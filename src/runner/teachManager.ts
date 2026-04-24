import { StateDef } from '../types';
import { appendUniqueLearning as appendUniqueLearningFn } from '../context/learningStore';
import { AgentRegistry } from '../registry/agentRegistry';

export interface TeachDeps {
  cwd: string;
  workflowArg?: string;
  agentRegistry: AgentRegistry;
  readLatestRun: (cwd: string, stateId: string, workflowArg?: string) => string | null;
  appendUniqueLearning: typeof appendUniqueLearningFn;
  record: (stateId: string, meta?: Record<string, unknown>) => boolean;
  contextVars?: Record<string, string> | undefined;
  // Optional getter to access current context vars at teach time (avoids stale snapshots)
  getContextVars?: () => Record<string, string> | undefined;
}

/**
 * Encapsulates teach logic: validate agents, read referenced outputs/vars and append learnings.
 */
export class TeachManager {
  private readonly cwd: string;
  private readonly workflowArg?: string;
  private readonly agentRegistry: AgentRegistry;
  private readonly readLatestRun: TeachDeps['readLatestRun'];
  private readonly appendUniqueLearning: TeachDeps['appendUniqueLearning'];
  private readonly record: TeachDeps['record'];
  private readonly contextVars?: Record<string, string> | undefined;
  private readonly getContextVars?: (() => Record<string, string> | undefined) | undefined;

  constructor(deps: TeachDeps) {
    this.cwd = deps.cwd;
    this.workflowArg = deps.workflowArg;
    this.agentRegistry = deps.agentRegistry;
    this.readLatestRun = deps.readLatestRun;
    this.appendUniqueLearning = deps.appendUniqueLearning;
    this.record = deps.record;
    this.contextVars = deps.contextVars;
    this.getContextVars = deps.getContextVars;
  }

  async teach(stateId: string, stateDef: StateDef): Promise<void> {
    const teach = stateDef.config.teach;
    if (!teach) return;

    const agentIds = Object.keys(teach);
    const missing = agentIds.filter((id) => !(id in this.agentRegistry));
    if (missing.length > 0) {
      throw new Error(`State '${stateId}': teach references missing agents: ${missing.join(', ')}`);
    }

    const recorded: { agent: string; source: string }[] = [];

    for (const [agentId, arr] of Object.entries(teach)) {
      if (!Array.isArray(arr)) continue;
      for (const entry of arr) {
        if (!entry || typeof entry !== 'object') continue;
        if ('output' in entry) {
          const ref = String(entry.output);
          const content = this.readLatestRun(this.cwd, ref, this.workflowArg);
          if (!content || String(content).trim() === '') {
            throw new Error(
              `State '${stateId}': teach referenced output '${ref}' produced no content`,
            );
          }
          const appended = this.appendUniqueLearning(
            this.cwd,
            agentId,
            `output:${ref}`,
            content,
            this.workflowArg,
            entry.scope,
          );
          if (appended) recorded.push({ agent: agentId, source: `output:${ref}` });
        } else if ('var' in entry) {
          const raw = String(entry.var);
          const m = /^\$\{([A-Za-z_][A-Za-z0-9_]*)\}$/.exec(raw);
          if (!m) {
            throw new Error(
              `State '${stateId}': teach var entry '${raw}' must be in the form \${'{VAR_NAME}'} `,
            );
          }
          const varName = m[1];
          const vars = this.getContextVars ? this.getContextVars() : this.contextVars;
          if (!vars || !(varName in vars)) {
            throw new Error(`State '${stateId}': teach var '${varName}' not found in context`);
          }
          const val = vars[varName];
          if (val && String(val).trim()) {
            const appended = this.appendUniqueLearning(
              this.cwd,
              agentId,
              `var:${varName}`,
              val,
              this.workflowArg,
              entry.scope,
            );
            if (appended) recorded.push({ agent: agentId, source: `var:${varName}` });
          }
        }
      }
    }

    if (recorded.length > 0) {
      this.record(stateId, { teach: recorded });
    }
  }
}
