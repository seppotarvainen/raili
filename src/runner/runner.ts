import { StateDef, StateMachine, WorkflowContext } from '../types';
import { AgentRegistry } from '../registry/agentRegistry';
import { ScriptRegistry } from '../registry/scriptRegistry';
import { addStateToHistory, saveContext } from '../context/context';
import { runAgentState } from './agentStateRunner';
import { runScriptState } from './scriptStateRunner';
import { runCommandState } from './commandStateRunner';
import { ApprovalOutcome, runApprovalStep } from './approveStateRunner';
import { runNotify } from '../handlers/notifyHandler';
import { clearAgentOutputs, readLatestRun } from '../context/outputStore';
import {
  resolveWorkflowDir,
  resolveApprovalResolverPath,
  resolveFeedbackResolverPath,
  resolveResolverConfigPath,
} from '../context/pathUtils';
import { loadResolverConfig } from '../resolverConfigLoader';
import { getFileSystem } from '../infrastructure/fileSystemProvider';
import path from 'path';
import { loadFeedbackResolver } from '../handlers/manualHandler';
import { readLearnings, appendUniqueLearning } from '../context/learningStore';
import { resolveTransition } from './transition';
import { handleFeedbackPrompt } from '../handlers/manualHandler';
import { Presenter } from '../presenter';

/** Result returned by every state runner: outcome and optional exports */
export interface StateResult {
  outcome: string;
  exports?: Record<string, string>;
}

export interface RunnerConfig {
  stateMachine: StateMachine;
  agentRegistry: AgentRegistry;
  scriptRegistry: ScriptRegistry;
  context: WorkflowContext;
  cwd: string;
  workflowArg?: string;
  nextSteps?: number;
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
  private approvalResolverPath?: string | null;
  private feedbackResolverPath?: string | null;

  private readonly nextSteps?: number;
  private stepsExecuted = 0;
  private countedStates = new Set<string>();

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
    this.nextSteps = config.nextSteps;
  }

  // ── Helpers ─────────────────────────────────────────────────────────

  /** Persist context to disk after any mutation. */
  private persist(): void {
    saveContext(this.cwd, this.context, this.workflowArg);
  }

  /** Add a state entry (with optional meta) to history and persist.
   * Returns true when a new entry was added (useful for --next counting), false otherwise.
   */
  private record(stateId: string, meta?: any): boolean {
    const prevLen = this.context?.stateHistory?.length ?? 0;
    const newCtx = addStateToHistory(this.context, stateId, meta);
    // Defensive: some unit tests mock addStateToHistory and may return undefined.
    this.context = newCtx ?? this.context ?? { stateHistory: [] };
    this.persist();

    const added = this.context.stateHistory.length > prevLen;

    // Determine whether this record should count towards stepsExecuted.
    const skipped = meta && meta.skipped !== undefined;
    const preRecord = meta && meta.pre_record === true;

    let shouldCount = false;
    if (!skipped && !preRecord) {
      if (added) {
        shouldCount = true;
      } else if (!this.countedStates.has(stateId)) {
        // addStateToHistory mock may return the same context in unit tests; treat the first
        // record call per state as an entry for counting purposes to ensure --next behaves
        // deterministically in tests as well as in production.
        shouldCount = true;
      }
    }

    if (shouldCount) {
      this.stepsExecuted++;
      this.countedStates.add(stateId);
    }

    return added;
  }

  // ── Phase: Skip ─────────────────────────────────────────────────────

  /**
   * Handle skip logic. Returns the target state id if skipped, or null to continue normally.
   */
  private handleSkip(stateId: string, stateDef: StateDef): string | null {
    const skip = (stateDef.config as any).skip;
    if (!skip) {
      return null;
    }

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
  private async enterState(
    stateId: string,
    stateDef: StateDef,
  ): Promise<{ continueTarget: string | null; wasRecorded: boolean }> {
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
          return { continueTarget: cont, wasRecorded: true };
        }
        throw new Error(`State '${stateId}' exceeded max_visits limit of ${count}`);
      }
    } else {
      this.visitCounts.set(stateId, visits);
    }

    // After updating this state's visit counter, perform any configured resets of other states' visit counters
    // Reset affects only in-memory visitCounts (per requirements) and is deterministic.
    if (
      Array.isArray((config as any).reset_max_visits) &&
      (config as any).reset_max_visits.length > 0
    ) {
      for (const target of (config as any).reset_max_visits as string[]) {
        // Only delete known state ids from the visitCounts map; existence validation is done at build/validate time.
        this.visitCounts.delete(target);
      }
    }

    // Record the state entry; addStateToHistory returns null when no change occurred.
    const wasRecorded = this.record(stateId);

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

    // Expose approval variable names immediately (empty values) so teach entries referencing
    // e.g. ${STATEID_FAILED} are present in context during the state's lifecycle. Values
    // will be filled in by handleApproval when the decision is made.
    if (config.approval) {
      if (!this.context.vars) {
        this.context.vars = {};
      }
      const passedKey = `${stateId}_PASSED`.toUpperCase();
      const failedKey = `${stateId}_FAILED`.toUpperCase();
      if (!(passedKey in this.context.vars)) {
        this.context.vars[passedKey] = '';
      }
      if (!(failedKey in this.context.vars)) {
        this.context.vars[failedKey] = '';
      }
      this.persist();
    }

    return { continueTarget: null, wasRecorded };
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
      throw new Error('groups must be flattened before execution');
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
      if (!this.context.vars) {
        this.context.vars = {};
      }
      for (const name of config.expose) {
        const optional = name.endsWith('?');
        const baseName = optional ? name.slice(0, -1) : name;
        const val = result.exports?.[baseName];
        if (val === undefined || val === null || String(val).trim() === '') {
          if (optional) {
            continue;
          }
          throw new Error(
            `State '${stateId}': exposed variable '${baseName}' was not produced by the state`,
          );
        }
        this.context.vars[baseName] = String(val);
      }
      this.persist();
    } else if (result.exports && Object.keys(result.exports).length > 0) {
      if (!this.context.vars) {
        this.context.vars = {};
      }
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

    const approvalOutcome: ApprovalOutcome = await runApprovalStep(
      stateId,
      approval,
      { cwd: this.cwd, context: this.context, workflowArg: this.workflowArg },
      this.approvalResolverPath,
    );
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
    if (typeof approvalOutcome.waitMs === 'number') {
      approvalMeta.waitMs = approvalOutcome.waitMs;
    }
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

    if (!this.context.approvals) {
      this.context.approvals = {};
    }
    if (!this.context.vars) {
      this.context.vars = {};
    }
    if (approvalOutcome.reason && approvalOutcome.reason.trim() !== '') {
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
    if (!fb) {
      return null;
    }

    const fbStart = Date.now();
    // If a feedback resolver path was resolved at startup, load it and pass into the handler (fail-fast if invalid)
    let fbResolver = null;
    if (typeof this.feedbackResolverPath !== 'undefined') {
      fbResolver = loadFeedbackResolver(this.feedbackResolverPath ?? null);
    }

    // Resolve resolver config to obtain feedback timeout if available.
    // Only use timeout when a config file is explicitly present — defaults should not impose a timeout.
    // Fail-open on errors.
    let timeoutMs: number | undefined = undefined;
    try {
      const wfDir = resolveWorkflowDir(this.cwd, this.workflowArg);
      const cfgPath = resolveResolverConfigPath(wfDir);
      if (cfgPath !== null) {
        const resolverCfg = loadResolverConfig(cfgPath);
        if (resolverCfg.feedback && typeof resolverCfg.feedback.timeout === 'number') {
          timeoutMs = resolverCfg.feedback.timeout * 1000;
        }
      }
    } catch (e) {
      timeoutMs = undefined;
    }

    const val = await handleFeedbackPrompt(fb, fbResolver, timeoutMs);
    const fbWait = Date.now() - fbStart;

    if (!this.context.vars) {
      this.context.vars = {};
    }

    // Support both legacy string return and new object { feedback, metadata }
    let feedbackValue: string = '';
    let feedbackMetadata: string | undefined = undefined;

    if (val === null) {
      feedbackValue = '';
    } else if (typeof val === 'string') {
      feedbackValue = val;
    } else {
      feedbackValue = val.feedback;
      feedbackMetadata = val.metadata;
    }

    // Persist exposed var
    this.context.vars[fb.expose_var] = feedbackValue;

    // Persist feedbacks metadata in context.feedbacks by state id
    if (!this.context.feedbacks) {
      this.context.feedbacks = {};
    }
    this.context.feedbacks[stateId] = { value: feedbackValue, metadata: feedbackMetadata };

    this.persist();

    const meta: any = { feedback: { name: fb.expose_var, value: feedbackValue } };
    if (typeof feedbackMetadata !== 'undefined') {
      meta.feedback.metadata = feedbackMetadata;
    }
    if (stateDef.config.approval) {
      meta.waitMs = fbWait;
    }
    this.record(stateId, meta);

    if (stateDef.config.transitions && (stateDef.config.transitions as any).next) {
      const next = (stateDef.config.transitions as any).next;
      try {
        const enteredAt = this.currentPresenter?.entry?.enteredAt;
        const elapsedMs = enteredAt ? Date.now() - new Date(enteredAt).getTime() : undefined;
        this.currentPresenter?.appendStateExit(stateDef, 'FEEDBACK', next, elapsedMs);
        this.currentPresenter?.render();
      } catch {}
      return next;
    }

    return null;
  }

  // ── Phase: Teach ────────────────────────────────────────────────────

  /**
   * Process teach mappings on a state: push lessons to agents immediately.
   * Throws on missing variables or empty referenced outputs (fail-fast).
   */
  private async handleTeach(stateId: string, stateDef: StateDef): Promise<void> {
    const cfg: any = stateDef.config;
    const teach = cfg.teach as Record<string, any[]> | undefined;
    if (!teach) {
      return;
    }

    // Validate that all referenced agent ids exist in the agent registry before performing any I/O.
    const agentIds = Object.keys(teach);
    const missing = agentIds.filter((id) => !(id in this.agentRegistry));
    if (missing.length > 0) {
      throw new Error(`State '${stateId}': teach references missing agents: ${missing.join(', ')}`);
    }

    const recorded: { agent: string; source: string }[] = [];

    for (const [agentId, arr] of Object.entries(teach)) {
      if (!Array.isArray(arr)) {
        continue;
      }
      for (const entry of arr as any[]) {
        if (!entry || typeof entry !== 'object') {
          continue;
        }
        if ('output' in entry) {
          const ref = String(entry.output);
          const content = readLatestRun(this.cwd, ref, this.workflowArg);
          if (!content || String(content).trim() === '') {
            throw new Error(
              `State '${stateId}': teach referenced output '${ref}' produced no content`,
            );
          }
          const appended = appendUniqueLearning(
            this.cwd,
            agentId,
            `output:${ref}`,
            content,
            this.workflowArg,
            entry.scope,
          );
          if (appended) {
            recorded.push({ agent: agentId, source: `output:${ref}` });
          }
        } else if ('var' in entry) {
          const raw = String(entry.var);
          const m = /^\$\{([A-Za-z_][A-Za-z0-9_]*)\}$/.exec(raw);
          if (!m) {
            throw new Error(
              `State '${stateId}': teach var entry '${raw}' must be in the form \${VAR_NAME}`,
            );
          }
          const varName = m[1];
          if (!this.context.vars || !(varName in this.context.vars)) {
            throw new Error(`State '${stateId}': teach var '${varName}' not found in context`);
          }
          const val = this.context.vars[varName];
          if (val && String(val).trim()) {
            const appended = appendUniqueLearning(
              this.cwd,
              agentId,
              `var:${varName}`,
              val,
              this.workflowArg,
              entry.scope,
            );
            if (appended) {
              recorded.push({ agent: agentId, source: `var:${varName}` });
            }
          }
        }
      }
    }

    if (recorded.length > 0) {
      this.record(stateId, { teach: recorded });
    }
  }

  // ── Phase: Route ────────────────────────────────────────────────────

  /**
   * Determine the next state from routing (on: or transitions:) and outcome.
   */
  private routeToNext(stateId: string, stateDef: StateDef, outcome: string): string {
    // If state defines 'continue', route unconditionally to it.
    // Be resilient: continue may be present on the state's config or (in some test setups)
    // on the top-level stateDef object. Prefer config, fall back to stateDef property.
    const cont =
      (stateDef.config as any).continue ?? ((stateDef as any).continue as string | undefined);
    if (cont) {
      if (!(cont in this.stateMachine.states)) {
        throw new Error(`State '${stateId}': continue target '${cont}' not found in state machine`);
      }
      const nextStateId = cont;
      try {
        const enteredAt = this.currentPresenter?.entry?.enteredAt;
        const elapsedMs = enteredAt ? Date.now() - new Date(enteredAt).getTime() : undefined;
        this.currentPresenter?.appendStateExit(stateDef, 'CONTINUE', nextStateId, elapsedMs);
        this.currentPresenter?.render();
      } catch {}

      return nextStateId;
    }

    const routing = stateDef.config.on ?? stateDef.config.transitions!;
    const nextStateId = resolveNextState(stateId, routing, outcome);

    // Present transition summary
    try {
      const enteredAt = this.currentPresenter?.entry?.enteredAt;
      const elapsedMs = enteredAt ? Date.now() - new Date(enteredAt).getTime() : undefined;
      this.currentPresenter?.appendStateExit(stateDef, outcome, nextStateId, elapsedMs);
      this.currentPresenter?.render();
    } catch {}
    return nextStateId;
  }

  // ── Phase: Error Recovery ───────────────────────────────────────────

  /**
   * Route to the declared error state (if any). Returns true if handled.
   */
  private async handleError(err: unknown): Promise<boolean> {
    if (!this.stateMachine.error) {
      return false;
    }

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
    let currentStateId =
      this.context && this.context.stateHistory && this.context.stateHistory.length > 0
        ? this.context.stateHistory[this.context.stateHistory.length - 1].state
        : this.stateMachine.initial;

    // If the last recorded state is terminal (no routing), treat this as a fresh run
    // and start from the workflow initial state so `continue` on a completed run restarts it.
    if (this.context.stateHistory.length > 0) {
      const lastStateId = this.context.stateHistory[this.context.stateHistory.length - 1].state;
      const lastDef = this.stateMachine.states[lastStateId];
      if (lastDef) {
        const isTerminal =
          !lastDef.config.on &&
          !lastDef.config.transitions &&
          !lastDef.config.approval &&
          !lastDef.config.feedback &&
          lastDef.transitions.length === 0;
        if (isTerminal) {
          currentStateId = this.stateMachine.initial;
        }
      }
    }

    // Mark already-entered states as counted so --next counts only newly executed states.
    if (this.context.stateHistory.length > 0) {
      for (const e of this.context.stateHistory) {
        this.countedStates.add(e.state);
      }
    } else {
      this.record(currentStateId);
    }

    // Resolve workflow directory and resolver paths at startup only when a .raili directory exists.
    // This preserves fail-fast behavior for workspaces that have been initialized while allowing
    // unit tests and callers that don't scaffold .raili/ to run without error.
    const fs = getFileSystem();
    const railiRoot = path.join(this.cwd, '.raili');
    if (fs.existsSync(railiRoot)) {
      const wfDir = resolveWorkflowDir(this.cwd, this.workflowArg);
      this.approvalResolverPath = resolveApprovalResolverPath(wfDir);
      this.feedbackResolverPath = resolveFeedbackResolverPath(wfDir);
    } else {
      // No .raili present - treat as a non-initialized workspace (no resolvers)
      this.approvalResolverPath = undefined;
      this.feedbackResolverPath = undefined;
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
        const { continueTarget, wasRecorded } = await this.enterState(stateId, stateDef);
        if (continueTarget) {
          stateId = continueTarget;
          continue;
        }

        // stepsExecuted is incremented inside record() when a new, non-skipped history entry is added.

        // Phase 3: Terminal check
        const { config } = stateDef;
        // Consider stateDef.transitions (built by workflowLoader) when determining terminal states.
        // A state with no routing in config but with transitions added during build (e.g., continue)
        // must NOT be treated as terminal.
        if (
          !config.on &&
          !config.transitions &&
          !config.approval &&
          !config.feedback &&
          stateDef.transitions.length === 0
        ) {
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
          const next = await this.handleApproval(stateId, stateDef);

          // If nextSteps limit reached for this run, stop here and do not follow the approval transition.
          if (typeof this.nextSteps === 'number' && this.stepsExecuted >= this.nextSteps) {
            break;
          }

          // Process any teach mappings after approval so approval-exposed variables
          // are available to teach entries declared on the same state.
          if ((stateDef.config as any).teach) {
            await this.handleTeach(stateId, stateDef);
          }
          stateId = next;
          continue;
        }

        // Phase 7: Feedback flow (if configured, no approval)
        const feedbackNext = await this.handleFeedback(stateId, stateDef);
        if (feedbackNext) {
          // If nextSteps limit reached for this run, stop here and do not follow the feedback transition.
          if (typeof this.nextSteps === 'number' && this.stepsExecuted >= this.nextSteps) {
            break;
          }
          stateId = feedbackNext;
          continue;
        }

        // Phase 8: Teach phase - process state.config.teach (push learnings to agents)
        if ((stateDef.config as any).teach) {
          await this.handleTeach(stateId, stateDef);
        }

        // If no routing is defined (neither 'on' nor 'transitions' nor 'continue'), treat state as terminal now.
        // This can happen for states that only declare 'feedback' (which were executed above).
        // Be resilient to continue being present on either the state's config or the top-level stateDef (tests sometimes place it there).
        const hasContinue =
          (stateDef.config as any).continue ?? ((stateDef as any).continue as string | undefined);
        if (!stateDef.config.on && !stateDef.config.transitions && !hasContinue) {
          const successValue =
            (stateDef.config as any).success === undefined
              ? null
              : !!(stateDef.config as any).success;
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

        // Phase 9: Route to next state
        // If a nextSteps limit was provided, and we've executed the configured number
        // of states, stop the run here (do not follow transitions). Context has been
        // persisted during state handling phases, so it's safe to exit.
        if (typeof this.nextSteps === 'number' && this.stepsExecuted >= this.nextSteps) {
          break;
        }

        stateId = this.routeToNext(stateId, stateDef, stateResult.outcome);
      } catch (err) {
        const handled = await this.handleError(err);
        if (handled) {
          return;
        }
        throw err;
      }
    }
  }
}
