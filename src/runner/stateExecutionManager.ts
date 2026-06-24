import {StateDef, WorkflowContext} from '../types';
import {StateResult} from './runner';

export type AgentRunner = (
  stateDef: StateDef,
  cwd: string,
  vars?: Record<string, string> | undefined,
  workflowArg?: string | undefined,
  verbose?: boolean,
) => Promise<StateResult>;

export type ScriptRunner = AgentRunner;
export type CommandRunner = AgentRunner;

export interface StateExecutionDeps {
  agentStateRunner: AgentRunner;
  scriptStateRunner: ScriptRunner;
  commandStateRunner: CommandRunner;
  cwd: string;
  workflowArg?: string;
}

/**
 * Responsible for dispatching execution to appropriate state runners and
 * merging exports into the runtime context. Keeps execution concerns
 * isolated from routing and history bookkeeping.
 */
export class StateExecutionManager {
  private readonly agentStateRunner: AgentRunner;
  private readonly scriptStateRunner: ScriptRunner;
  private readonly commandStateRunner: CommandRunner;
  private readonly cwd: string;
  private readonly workflowArg?: string;

  constructor(deps: StateExecutionDeps) {
    this.agentStateRunner = deps.agentStateRunner;
    this.scriptStateRunner = deps.scriptStateRunner;
    this.commandStateRunner = deps.commandStateRunner;
    this.cwd = deps.cwd;
    this.workflowArg = deps.workflowArg;
  }

  /**
   * Execute the given state and merge any exported variables into the provided context.
   * Throws when a declared non-optional expose variable is missing (fail-fast).
   */
  async executeAndExport(
    stateId: string,
    stateDef: StateDef,
    context: WorkflowContext,
  ): Promise<StateResult> {
    const cfg = stateDef.config;
    let result: StateResult;

    if (cfg.type === 'agent') {
      result = await this.agentStateRunner(stateDef, this.cwd, context.vars, this.workflowArg);
    } else if (cfg.type === 'script') {
      result = await this.scriptStateRunner(stateDef, this.cwd, context.vars, this.workflowArg);
    } else if (cfg.type === 'command') {
      result = await this.commandStateRunner(stateDef, this.cwd, context.vars, this.workflowArg);
    } else if (cfg.type === 'group') {
      throw new Error('groups must be flattened before execution');
    } else {
      // engine or unknown: no-op and returns PASSED
      result = { outcome: 'PASSED' };
    }

    // Merge exports into context according to expose rules
    if (cfg.expose && cfg.expose.length > 0) {
      if (!context.vars) context.vars = {};
      for (const name of cfg.expose) {
        const optional = name.endsWith('?');
        const baseName = optional ? name.slice(0, -1) : name;
        const val = result.exports ? result.exports[baseName] : undefined;
        if (val === undefined || val === null || String(val).trim() === '') {
          if (optional) continue;
          throw new Error(
            `State '${stateId}': exposed variable '${baseName}' was not produced by the state`,
          );
        }
        context.vars[baseName] = String(val);
      }
    } else if (result.exports && Object.keys(result.exports).length > 0) {
      if (!context.vars) context.vars = {};
      for (const [k, v] of Object.entries(result.exports)) {
        context.vars[k] = v as string;
      }
    }

    return result;
  }
}
