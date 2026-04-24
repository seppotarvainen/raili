import { StateDef } from '../types';
import { VisitTracker } from './visitTracker';
import { Presenter } from '../presenter';
import { NotifyResult } from '../handlers/notifyHandler';

export interface StateEntryResult {
  continueTarget?: string | null;
  wasRecorded: boolean;
  presenter?: Presenter | null;
}

export interface StateEntryManagerDeps {
  visitTracker: VisitTracker;
  outputStore: {
    clearAgentOutputs: (cwd: string, stateIds: string[], workflowArg?: string) => void;
    readLatestRun: (cwd: string, stateId: string, workflowArg?: string) => string | null;
  };
  notifyHandler: (
    command: string,
    cwd: string,
    vars?: Record<string, string>,
  ) => Promise<NotifyResult | undefined>;
  learningStore: {
    readLearnings: (cwd: string, agentId: string, workflowArg?: string) => string | null;
  };
  contextApi: {
    // Record a state entry. Returns true when a new history entry was added.
    record: (stateId: string, meta?: Record<string, unknown>) => boolean;
    // Optional helpers used by presenter creation
    getHistoryCount?: () => number;
    getLastEntry?: () => { enteredAt?: string } | null;
    // Optional vars storage and persist method
    vars?: Record<string, string>;
    persist?: () => void;
  };
  presenterFactory: () => Presenter;
  cwd: string;
  workflowArg?: string;
}

export class StateEntryManager {
  private readonly visitTracker: VisitTracker;
  private readonly outputStore: StateEntryManagerDeps['outputStore'];
  private readonly notifyHandler: StateEntryManagerDeps['notifyHandler'];
  private readonly learningStore: StateEntryManagerDeps['learningStore'];
  private readonly contextApi: StateEntryManagerDeps['contextApi'];
  private readonly presenterFactory: StateEntryManagerDeps['presenterFactory'];
  private readonly cwd: string;
  private readonly workflowArg?: string;

  constructor(deps: StateEntryManagerDeps) {
    this.visitTracker = deps.visitTracker;
    this.outputStore = deps.outputStore;
    this.notifyHandler = deps.notifyHandler;
    this.learningStore = deps.learningStore;
    this.contextApi = deps.contextApi;
    this.presenterFactory = deps.presenterFactory;
    this.cwd = deps.cwd;
    this.workflowArg = deps.workflowArg;
  }

  /**
   * Handle state entry responsibilities: max_visits enforcement, reset_outputs, history recording,
   * notify invocation, presenter creation, and approval variable initialization.
   */
  async enter(stateId: string, stateDef: StateDef): Promise<StateEntryResult> {
    const cfg = stateDef.config;

    // Increment visit counter via VisitTracker
    const visits = this.visitTracker.incrementVisit(stateId);

    // Handle max_visits structured object: { count, continue? }
    if (cfg.max_visits) {
      const mv = cfg.max_visits;
      const count = mv.count;
      const cont = mv.continue;
      if (visits > count) {
        if (cont) {
          // Record that max_visits was exceeded and return continuation target
          const wasRecorded = this.contextApi.record(stateId, {
            max_visits: { exceeded: true, target: cont },
          });
          return { continueTarget: cont, wasRecorded, presenter: null };
        }
        throw new Error(`State '${stateId}' exceeded max_visits limit of ${count}`);
      }
    }

    // After updating this state's visit counter, perform any configured resets of other states' visit counters
    if (Array.isArray(cfg.reset_max_visits) && cfg.reset_max_visits.length > 0) {
      this.visitTracker.resetVisits(cfg.reset_max_visits as string[]);
    }

    // Record the state entry via provided context API
    const wasRecorded = this.contextApi.record(stateId);

    // Handle reset_outputs
    if (Array.isArray(cfg.reset_outputs) && cfg.reset_outputs.length > 0) {
      this.outputStore.clearAgentOutputs(this.cwd, cfg.reset_outputs as string[], this.workflowArg);
    }

    // Compute whether earlier outputs or learnings applied (best-effort, non-fatal)
    let outputsApplied = false;
    let learningsApplied = false;
    try {
      const latest = this.outputStore.readLatestRun(this.cwd, stateId, this.workflowArg);
      outputsApplied = Boolean(latest);
      if (cfg.type === 'agent' && cfg.agent) {
        const lg = this.learningStore.readLearnings(this.cwd, cfg.agent, this.workflowArg);
        learningsApplied = !!lg && lg.trim().length > 0;
      }
    } catch (e) {
      // Swallow errors - presenter will gracefully handle missing data
    }

    // Prepare presenter
    const presenter = this.presenterFactory();

    const count = this.contextApi.getHistoryCount ? this.contextApi.getHistoryCount() : 0;
    const entry = this.contextApi.getLastEntry ? this.contextApi.getLastEntry() : undefined;

    try {
      presenter.appendStateEnter(
        stateDef,
        visits,
        count,
        entry?.enteredAt,
        learningsApplied,
        outputsApplied,
      );
      presenter.render();
    } catch (e) {
      // Rendering/presenter errors should not break core behavior
    }

    // Run notify if configured
    if (cfg.notify) {
      try {
        const notifyMeta = await this.notifyHandler(
          cfg.notify,
          this.cwd,
          this.contextApi.vars ?? {},
        );
        this.contextApi.record(stateId, { notify: notifyMeta });
      } catch (e) {
        // Do not swallow recording; runner's error handling will catch if needed
        this.contextApi.record(stateId, {
          notify: { command: cfg.notify, success: false, stderr: String(e) },
        });
      }
    }

    // Expose approval variable names immediately (empty values)
    if (cfg.approval) {
      if (!this.contextApi.vars) {
        this.contextApi.vars = {} as Record<string, string>;
      }
      const passedKey = `${stateId}_PASSED`.toUpperCase();
      const failedKey = `${stateId}_FAILED`.toUpperCase();
      if (!(passedKey in this.contextApi.vars)) {
        this.contextApi.vars[passedKey] = '';
      }
      if (!(failedKey in this.contextApi.vars)) {
        this.contextApi.vars[failedKey] = '';
      }
      if (this.contextApi.persist) {
        try {
          this.contextApi.persist();
        } catch {}
      }
    }

    return { continueTarget: null, wasRecorded, presenter };
  }
}
