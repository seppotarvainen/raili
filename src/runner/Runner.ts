import { StateDef, StateMachine, WorkflowContext } from '../types';
import { AgentRegistry } from '../registry/agentRegistry';
import { ScriptRegistry } from '../registry/scriptRegistry';
import { addStateToHistory, saveContext } from '../context/context';
import { runAgentState } from './AgentStateRunner';
import { runScriptState } from './ScriptStateRunner';
import { runCommandState } from './CommandStateRunner';
import { ApprovalOutcome, runApprovalStep } from './ApproveStateRunner';
import { runGroupState } from './GroupStateRunner';
import { runNotify } from '../handlers/notifyHandler';
import { clearAgentOutputs, readLatestRun } from '../context/outputStore';
import { readLearnings } from '../context/learningStore';
import { resolveTransition } from './transition';
import { handleFeedbackPrompt } from '../handlers/manualHandler';
import { Presenter } from '../presenter';

/** Result returned by every state runner: outcome and optional exports */
export type StateResult = { outcome: string; exports?: Record<string, string> };

export interface RunnerConfig {
  stateMachine: StateMachine;
  agentRegistry: AgentRegistry;
  scriptRegistry: ScriptRegistry;
  context: WorkflowContext;
  cwd: string;
  workflowArg?: string;
}

/**
 * Resolves the next state from a state's routing config and an outcome key.
 * Throws immediately if outcome is not mapped (fail-fast). Supports reserved `default` key.
 */
function resolveNextState(
  stateId: string,
  routing: Record<string, string>,
  outcome: string,
): string {
  const next = resolveTransition(routing, outcome);
  if (!next) {
    throw new Error(
      `State '${stateId}': outcome '${outcome}' has no matching transition (defined: ${Object.keys(routing).join(', ')})`,
    );
  }
  return next;
}

export class Runner {
  private readonly stateMachine: StateMachine;
  private readonly agentRegistry: AgentRegistry;
  private readonly scriptRegistry: ScriptRegistry;
  private context: WorkflowContext;
  private readonly cwd: string;
  private readonly workflowArg?: string;
  private readonly visitCounts = new Map<string, number>();

  constructor(config: RunnerConfig) {
    this.stateMachine = config.stateMachine;
    this.agentRegistry = config.agentRegistry;
    this.scriptRegistry = config.scriptRegistry;
    // Ensure context always has a valid shape to avoid undefined stateHistory
    this.context = config.context ?? { stateHistory: [] };
    if (!this.context.stateHistory) {
      this.context.stateHistory = [];
    }
    this.cwd = config.cwd;
    this.workflowArg = config.workflowArg;
  }

  // ── Helpers ─────────────────────────────────────────────────────────

  /** Persist context to disk after any mutation. */
  private persist(): void {
    saveContext(this.cwd, this.context, this.workflowArg);
  }

  /** Add a state entry (with optional meta) to history and persist. */
  private record(stateId: string, meta?: any): void {
    const newCtx = addStateToHistory(this.context, stateId, meta);
    if (newCtx) this.context = newCtx;
    this.persist();
  }

  // ── Phase: Skip ─────────────────────────────────────────────────────

  /**
   * Handle skip logic. Returns the target state id if skipped, or null to continue normally.
   */
  private handleSkip(stateId: string, stateDef: StateDef): string | null {
    const skip = (stateDef.config as any).skip;
    if (!skip) return null;

    const target = skip as string;
    if (!(target in this.stateMachine.states)) {
      throw new Error(`State '${stateId}': skip target '${target}' not found in state machine`);
    }

    this.record(stateId, { skipped: { target } });
    return target;
  }

  // ── Phase: Enter State ──────────────────────────────────────────────

  /**
   * On state entry: enforce max_visits, clear outputs, record in history, fire notify.
   */
  /**
   * On state entry: enforce max_visits, clear outputs, record in history, fire notify.
   * Returns a continuation target state id when max_visits is exceeded and a continue target is configured.
   */
  private async enterState(stateId: string, stateDef: StateDef): Promise<string | null> {
    const { config } = stateDef;
    const prev = this.visitCounts.get(stateId) ?? 0;
    const visits = prev + 1;

    // Handle max_visits structured object: { count, continue? }
    if (config.max_visits !== undefined && config.max_visits !== null) {
      const mv = config.max_visits as any;
      const count = mv.count as number;
      const cont = mv.continue as string | undefined;
      this.visitCounts.set(stateId, visits);
      if (visits > count) {
        if (cont) {
          this.record(stateId, { max_visits: { exceeded: true, target: cont } });
          return cont;
        }
        throw new Error(`State '${stateId}' exceeded max_visits limit of ${count}`);
      }
    } else {
      this.visitCounts.set(stateId, visits);
    }

    this.record(stateId);

    if (config.reset_outputs?.length) {
      clearAgentOutputs(this.cwd, config.reset_outputs, this.workflowArg);
    }

    const entry = this.context.stateHistory[this.context.stateHistory.length - 1];
    const count = this.context.stateHistory.length;

    let outputsApplied = false;
    let learningsApplied = false;
    try {
      const latestOutput = readLatestRun(this.cwd, stateId, this.workflowArg);
      outputsApplied = Boolean(latestOutput);
      if (config.type === 'agent' && config.agent) {
        const lg = readLearnings(this.cwd, config.agent, this.workflowArg);
        learningsApplied = !!lg && lg.trim().length > 0;
      }
    } catch (e) {
      // Workflow dir may not exist yet (e.g. clean run); presenter falls back to defaults.
    }

    const presenter = new Presenter();
    this.currentPresenter = presenter;
    presenter.appendStateEnter(
      stateDef,
      visits,
      count,
      entry?.enteredAt,
      learningsApplied,
      outputsApplied,
    );
    presenter.render();

    if (config.notify) {
      const notifyMeta = await runNotify(config.notify, this.cwd, this.context?.vars ?? {});
      this.record(stateId, { notify: notifyMeta });
    }

    return null;
  }

  // ── Phase: Execute State Handler ────────────────────────────────────

  /**
   * Dispatch to the appropriate state runner based on state type.
   */
  private async executeState(stateDef: StateDef): Promise<StateResult> {
    const { config } = stateDef;

    if (config.type === 'agent') {
      return runAgentState(
        stateDef,
        this.agentRegistry,
        this.cwd,
        this.context?.vars,
        this.workflowArg,
      );
    } else if (config.type === 'script') {
      return runScriptState(
        stateDef,
        this.scriptRegistry,
        this.cwd,
        this.context?.vars,
        this.workflowArg,
      );
    } else if (config.type === 'command') {
      return runCommandState(stateDef, this.cwd, this.context?.vars, this.workflowArg);
    } else if (config.type === 'group') {
      return runGroupState(
        stateDef,
        this.cwd,
        this.context?.vars,
        this.workflowArg,
        this.agentRegistry,
        this.scriptRegistry,
      );
    }
    return { outcome: 'PASSED' };
  }

  // ── Phase: Handle Exports ───────────────────────────────────────────

  /**
   * Merge exported variables from state result into context.
   * Validates that all declared `expose` names were produced (fail-fast).
   */
  private handleExports(stateId: string, stateDef: StateDef, result: StateResult): void {
    const { config } = stateDef;

    if (config.expose && config.expose.length > 0) {
      if (!this.context.vars) this.context.vars = {};
      for (const name of config.expose) {
        const val = result.exports?.[name];
        if (val === undefined || val === null || String(val).trim() === '') {
          throw new Error(
            `State '${stateId}': exposed variable '${name}' was not produced by the state`,
          );
        }
        this.context.vars[name] = String(val);
      }
      this.persist();
    } else if (result.exports && Object.keys(result.exports).length > 0) {
      if (!this.context.vars) this.context.vars = {};
      for (const [k, v] of Object.entries(result.exports)) {
        this.context.vars[k] = v;
      }
      this.persist();
    }
  }

  // ── Phase: Handle Approval ──────────────────────────────────────────

  /**
   * Run approval prompt, persist decision and reason, collect feedback if configured.
   * Returns the next state id.
   */
  private async handleApproval(stateId: string, stateDef: StateDef): Promise<string> {
    const approval = stateDef.config.approval!;

    const approvalOutcome: ApprovalOutcome = await runApprovalStep(stateId, approval, {
      cwd: this.cwd,
      context: this.context,
    });
    const nextStateId = resolveNextState(
      stateId,
      { PASSED: approval.PASSED, FAILED: approval.FAILED },
      approvalOutcome.chosen,
    );

    const approvalMeta: any = {
      approval: {
        question: approvalOutcome.question,
        chosen: approvalOutcome.chosen,
        reason: approvalOutcome.reason,
        notify: approvalOutcome.notify ?? undefined,
      },
    };
    if (typeof approvalOutcome.waitMs === 'number') approvalMeta.waitMs = approvalOutcome.waitMs;
    // Present approval exit summary with resolved next
    try {
      const enteredAt = this.currentPresenter?.entry?.enteredAt;
      const elapsedMs = enteredAt ? Date.now() - new Date(enteredAt).getTime() : undefined;
      this.currentPresenter?.appendStateExit(
        stateDef,
        approvalOutcome.chosen,
        nextStateId,
        elapsedMs,
      );
      this.currentPresenter?.render();
    } catch {}

    this.record(stateId, approvalMeta);

    if (!this.context.approvals) this.context.approvals = {};
    if (!this.context.vars) this.context.vars = {};
    if (
      approvalOutcome.chosen === 'FAILED' &&
      approvalOutcome.reason &&
      approvalOutcome.reason.trim() !== ''
    ) {
      const key = `${stateId}_${approvalOutcome.chosen}`.toUpperCase();
      this.context.approvals[key] = approvalOutcome.reason;
      this.context.vars[key] = approvalOutcome.reason;
    }
    this.persist();

    // After approval, optionally collect feedback
    await this.handleFeedback(stateId, stateDef);

    return nextStateId;
  }

  // ── Phase: Handle Feedback ──────────────────────────────────────────

  /**
   * Collect user feedback if configured on the state.
   * Returns the next state id if feedback routing applies, or null.
   */
  private async handleFeedback(stateId: string, stateDef: StateDef): Promise<string | null> {
    const fb = (stateDef.config as any).feedback as any;
    if (!fb) return null;

    const fbStart = Date.now();
    const val = await handleFeedbackPrompt(fb);
    const fbWait = Date.now() - fbStart;

    if (!this.context.vars) this.context.vars = {};
    this.context.vars[fb.expose_var] = val;
    this.persist();

    const meta: any = { feedback: { name: fb.expose_var, value: val } };
    if (stateDef.config.approval) meta.waitMs = fbWait;
    this.record(stateId, meta);

    if (stateDef.config.transitions && (stateDef.config.transitions as any).next) {
      const next = (stateDef.config.transitions as any).next;
      try {
        const enteredAt = this.currentPresenter?.entry?.enteredAt;
        const elapsedMs = enteredAt ? Date.now() - new Date(enteredAt).getTime() : undefined;
        this.currentPresenter?.appendStateExit(stateDef, 'FEEDBACK', next, elapsedMs);
        this.currentPresenter?.render();
      } catch {}
      this.record(next);
      return next;
    }

    return null;
  }

  // ── Phase: Route ────────────────────────────────────────────────────

  /**
   * Determine the next state from routing (on: or transitions:) and outcome.
   */
  private routeToNext(stateId: string, stateDef: StateDef, outcome: string): string {
    const routing = stateDef.config.on ?? stateDef.config.transitions!;
    const nextStateId = resolveNextState(stateId, routing, outcome);

    // Present transition summary
    try {
      const enteredAt = this.currentPresenter?.entry?.enteredAt;
      const elapsedMs = enteredAt ? Date.now() - new Date(enteredAt).getTime() : undefined;
      this.currentPresenter?.appendStateExit(stateDef, outcome, nextStateId, elapsedMs);
      this.currentPresenter?.render();
    } catch {}

    this.record(nextStateId);
    return nextStateId;
  }

  // ── Phase: Error Recovery ───────────────────────────────────────────

  /**
   * Route to the declared error state (if any). Returns true if handled.
   */
  private async handleError(err: unknown): Promise<boolean> {
    if (!this.stateMachine.error) return false;

    const errStateId = this.stateMachine.error;
    const errDef = this.stateMachine.states[errStateId];
    if (!errDef) {
      throw new Error(
        `Runner encountered error and declared error state '${errStateId}' not found`,
      );
    }

    const errConfig = errDef.config;
    if (errConfig.reset_outputs?.length) {
      clearAgentOutputs(this.cwd, errConfig.reset_outputs, this.workflowArg);
    }
    if (errConfig.notify) {
      try {
        const n = await runNotify(errConfig.notify, this.cwd, this.context.vars ?? {});
        this.record(errStateId, { notify: n });
      } catch {}
    }

    this.record(errStateId);
    console.log(`! Runner: unhandled error occurred — routed to error state: ${errStateId}`);
    return true;
  }

  // ── Main Loop ───────────────────────────────────────────────────────
  private currentPresenter?: Presenter | null;

  /**
   * Run the workflow from the current (or initial) state until a terminal state is reached.
   */
  async run(): Promise<void> {
    const currentStateId =
      this.context && this.context.stateHistory && this.context.stateHistory.length > 0
        ? this.context.stateHistory[this.context.stateHistory.length - 1].state
        : this.stateMachine.initial;

    if (this.context.stateHistory.length === 0) {
      this.record(currentStateId);
    }

    let stateId = currentStateId;

    while (true) {
      try {
        const stateDef = this.stateMachine.states[stateId];
        if (!stateDef) {
          throw new Error(`Runner: state '${stateId}' not found in state machine`);
        }

        // Phase 1: Skip
        const skipTarget = this.handleSkip(stateId, stateDef);
        if (skipTarget) {
          stateId = skipTarget;
          continue;
        }

        // Phase 2: Enter state (max_visits, reset_outputs, history, notify)
        const continueTarget = await this.enterState(stateId, stateDef);
        if (continueTarget) {
          stateId = continueTarget;
          continue;
        }

        // Phase 3: Terminal check
        const { config } = stateDef;
        if (!config.on && !config.transitions && !config.approval) {
          const successValue = config.success === undefined ? null : !!config.success;
          this.record(stateId, { success: successValue });

          // Present terminal exit summary
          try {
            const enteredAt = this.currentPresenter?.entry?.enteredAt;
            const elapsedMs = enteredAt ? Date.now() - new Date(enteredAt).getTime() : undefined;
            this.currentPresenter?.appendStateExit(stateDef, 'TERMINAL', undefined, elapsedMs);
            this.currentPresenter?.render();
          } catch {}

          break;
        }

        // Phase 4: Execute state handler
        const stateResult = await this.executeState(stateDef);

        // Phase 5: Handle exports
        this.handleExports(stateId, stateDef, stateResult);

        // Phase 6: Approval flow (if configured)
        if (config.approval) {
          stateId = await this.handleApproval(stateId, stateDef);
          continue;
        }

        // Phase 7: Feedback flow (if configured, no approval)
        const feedbackNext = await this.handleFeedback(stateId, stateDef);
        if (feedbackNext) {
          stateId = feedbackNext;
          continue;
        }

        // Phase 8: Route to next state
        stateId = this.routeToNext(stateId, stateDef, stateResult.outcome);
      } catch (err) {
        const handled = await this.handleError(err);
        if (handled) return;
        throw err;
      }
    }
  }
}
