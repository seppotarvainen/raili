import {CancellationToken, StateMachine, TokenUsage, WorkflowContext} from '../types';
import {AgentRegistry} from '../registry/agentRegistry';
import {ScriptRegistry} from '../registry/scriptRegistry';
import {addStateToHistory, saveContext} from '../context/context';
import {runAgentState} from './agentStateRunner';
import {runScriptState} from './scriptStateRunner';
import {runCommandState} from './commandStateRunner';
import {runNotify} from '../handlers/notifyHandler';
import {clearAgentOutputs, readLatestRun} from '../context/outputStore';
import {resolveApprovalResolverPath, resolveFeedbackResolverPath, resolveWorkflowDir,} from '../context/pathUtils';
import {getFileSystem} from '../infrastructure/fileSystemProvider';
import path from 'path';
import {appendUniqueLearning, readLearnings} from '../context/learningStore';
import {Presenter} from '../presenter';
import {InteractiveFlowManager} from './interactiveFlowManager';
import {TeachManager} from './teachManager';
import {StateEntryManager} from './stateEntryManager';
import {StateExecutionManager} from './stateExecutionManager';
import {RoutingManager} from './routingManager';
import {VisitTracker} from './visitTracker';

/** Result returned by every state runner: outcome and optional exports */
export interface StateResult {
  outcome: string;
  cancelled?: boolean;
  exports?: Record<string, string>;
  tokens?: TokenUsage;
}

export interface RunnerConfig {
  stateMachine: StateMachine;
  agentRegistry: AgentRegistry;
  scriptRegistry: ScriptRegistry;
  context: WorkflowContext;
  cwd: string;
  workflowArg?: string;
  nextSteps?: number;
  verbose?: boolean;
  cancellationToken?: CancellationToken;
}

export class Runner {
  private readonly stateMachine: StateMachine;
  private readonly agentRegistry: AgentRegistry;
  private readonly scriptRegistry: ScriptRegistry;
  private context: WorkflowContext;
  private readonly cwd: string;
  private readonly workflowArg?: string;
  private approvalResolverPath?: string | null;
  private feedbackResolverPath?: string | null;

  private readonly nextSteps?: number;
  private readonly verbose?: boolean;
  private readonly cancellationToken?: CancellationToken;
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
    this.verbose = config.verbose;
    this.cancellationToken = config.cancellationToken;
  }

  // ── Helpers ─────────────────────────────────────────────────────────

  /** Persist context to disk after any mutation. */
  private persist(): void {
    saveContext(this.cwd, this.context, this.workflowArg);
  }

  /** Add a state entry (with optional meta) to history and persist.
   * Returns true when a new entry was added (useful for --next counting), false otherwise.
   */
  private record(stateId: string, meta?: Record<string, unknown>): boolean {
    const prevLen = this.context?.stateHistory?.length ?? 0;
    const newCtx = addStateToHistory(this.context, stateId, meta);
    // Defensive: some unit tests mock addStateToHistory and may return undefined.
    this.context = newCtx ?? this.context ?? { stateHistory: [] };
    this.persist();

    const added = this.context.stateHistory.length > prevLen;

    // Determine whether this record should count towards stepsExecuted.
    const skipped = Boolean(meta && (meta as Record<string, unknown>)['skipped'] !== undefined);
    const preRecord = Boolean(meta && (meta as Record<string, unknown>)['pre_record'] === true);

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

  // ── Main Loop ───────────────────────────────────────────────────────
  private currentPresenter?: Presenter | undefined;

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

    // Instantiate managers that orchestrate interactive flows and teaching.
    const interactiveManager = new InteractiveFlowManager({
      cwd: this.cwd,
      workflowArg: this.workflowArg,
      approvalResolverPath: this.approvalResolverPath,
      feedbackResolverPath: this.feedbackResolverPath,
      cancellationToken: this.cancellationToken,
      ctxApi: {
        record: (s: string, m?: Record<string, unknown>) => this.record(s, m),
        persist: () => this.persist(),
        context: () => this.context,
      },
    });

    const teachManager = new TeachManager({
      cwd: this.cwd,
      workflowArg: this.workflowArg,
      agentRegistry: this.agentRegistry,
      readLatestRun,
      appendUniqueLearning,
      record: (s: string, m?: Record<string, unknown>) => this.record(s, m),
      // Provide a getter so TeachManager reads up-to-date context vars (avoid stale snapshot)
      getContextVars: () => this.context.vars,
    });

    const stateVisitTracker = new VisitTracker();
    const stateEntryManager = new StateEntryManager({
      visitTracker: stateVisitTracker,
      outputStore: { clearAgentOutputs, readLatestRun },
      notifyHandler: runNotify,
      learningStore: { readLearnings },
      contextApi: {
        record: (s: string, m?: Record<string, unknown>) => this.record(s, m),
        getHistoryCount: () => this.context.stateHistory.length,
        getLastEntry: () => this.context.stateHistory[this.context.stateHistory.length - 1] ?? null,
        vars: this.context.vars,
        persist: () => this.persist(),
      },
      presenterFactory: () => new Presenter(),
      cwd: this.cwd,
      workflowArg: this.workflowArg,
    });

    const stateExecutionManager = new StateExecutionManager({
      agentStateRunner: (stateDef, cwd, vars, wfArg, cancellationToken) =>
        runAgentState(
          stateDef,
          this.agentRegistry,
          cwd,
          vars,
          wfArg,
          this.verbose,
          cancellationToken,
        ),
      scriptStateRunner: (stateDef, cwd, vars, wfArg, cancellationToken) =>
        runScriptState(stateDef, this.scriptRegistry, cwd, vars, wfArg, cancellationToken),
      commandStateRunner: (stateDef, cwd, vars, wfArg, cancellationToken) =>
        runCommandState(stateDef, cwd, vars, wfArg, cancellationToken),
      cwd: this.cwd,
      workflowArg: this.workflowArg,
    });

    const routingManager = new RoutingManager({
      runNotify: runNotify,
      clearAgentOutputs: clearAgentOutputs,
      cwd: this.cwd,
      workflowArg: this.workflowArg,
    });

    let stateId = currentStateId;

    while (true) {
      try {
        const stateDef = this.stateMachine.states[stateId];
        if (!stateDef) {
          throw new Error(`Runner: state '${stateId}' not found in state machine`);
        }

        // Phase 1: Skip - use RoutingManager
        const skipTarget = routingManager.evaluateSkip(stateId, stateDef, this.stateMachine);
        if (skipTarget) {
          // Record that the state was skipped (fail-fast history entry) and then continue to target
          this.record(stateId, { skipped: { target: skipTarget } });
          stateId = skipTarget;
          continue;
        }

        // Phase 2: Enter state (max_visits, reset_outputs, history, notify) via StateEntryManager
        const entryResult = await stateEntryManager.enter(stateId, stateDef);
        this.currentPresenter = entryResult.presenter ?? undefined;
        if (entryResult.continueTarget) {
          stateId = entryResult.continueTarget;
          continue;
        }

        if (this.cancellationToken?.isCancellationRequested) {
          this.record(stateId, { cancelled: new Date().toISOString() });
          return;
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

        // Phase 4: Execute state handler via StateExecutionManager
        const stateResult = await stateExecutionManager.executeAndExport(
          stateId,
          stateDef,
          this.context,
          this.cancellationToken,
        );

        if (
          stateResult.cancelled ||
          stateResult.outcome === 'CANCELLED' ||
          this.cancellationToken?.isCancellationRequested
        ) {
          this.record(stateId, { cancelled: new Date().toISOString() });
          return;
        }

        // Persist token usage into the most recent history entry when present.
        // This ensures token accounting is attached to the state that produced them.
        if (stateResult.tokens) {
          this.record(stateId, { tokens: stateResult.tokens });
        }

        // Phase 6: Approval flow (if configured)
        if (config.approval) {
          const next = await interactiveManager.handleApproval(
            stateId,
            stateDef,
            this.currentPresenter,
          );

          if (this.cancellationToken?.isCancellationRequested) {
            this.record(stateId, { cancelled: new Date().toISOString() });
            return;
          }

          // If nextSteps limit reached for this run, stop here and do not follow the approval transition.
          if (typeof this.nextSteps === 'number' && this.stepsExecuted >= this.nextSteps) {
            break;
          }

          // Process any teach mappings after approval so approval-exposed variables
          // are available to teach entries declared on the same state.
          if (stateDef.config.teach) {
            await teachManager.teach(stateId, stateDef);
          }
          stateId = next;
          continue;
        }

        // Phase 7: Feedback flow (if configured, no approval)
        const feedbackNext = await interactiveManager.handleFeedback(
          stateId,
          stateDef,
          this.currentPresenter,
        );
        if (this.cancellationToken?.isCancellationRequested) {
          this.record(stateId, { cancelled: new Date().toISOString() });
          return;
        }
        if (feedbackNext) {
          // If nextSteps limit reached for this run, stop here and do not follow the feedback transition.
          if (typeof this.nextSteps === 'number' && this.stepsExecuted >= this.nextSteps) {
            break;
          }
          stateId = feedbackNext;
          continue;
        }

        // Phase 8: Teach phase - process state.config.teach (push learnings to agents)
        if (stateDef.config.teach) {
          await teachManager.teach(stateId, stateDef);
        }

        // If no routing is defined (neither 'on' nor 'transitions' nor 'continue'), treat state as terminal now.
        // This can happen for states that only declare 'feedback' (which were executed above).
        // Be resilient to continue being present on either the state's config or the top-level stateDef (tests sometimes place it there).
        const hasContinue =
          stateDef.config.continue ?? (stateDef as unknown as { continue?: string }).continue;
        if (!stateDef.config.on && !stateDef.config.transitions && !hasContinue) {
          const successValue =
            stateDef.config.success === undefined ? null : !!stateDef.config.success;
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

        stateId = routingManager.routeToNext(
          stateId,
          stateDef,
          stateResult.outcome,
          this.stateMachine,
          this.currentPresenter,
        );
      } catch (err) {
        const handled = await routingManager.routeError(err, this.stateMachine, this.context);
        if (handled) {
          // Record that error state was entered and stop the run.
          if (this.stateMachine.error) {
            this.record(this.stateMachine.error);
          }
          return;
        }
        throw err;
      }
    }
  }
}
