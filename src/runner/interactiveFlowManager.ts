import { CancellationToken, StateDef, WorkflowContext } from '../types';
import { ApprovalOutcome, runApprovalStep } from './approveStateRunner';
import { handleFeedbackPrompt, loadFeedbackResolver } from '../handlers/manualHandler';
import { resolveResolverConfigPath, resolveWorkflowDir } from '../context/pathUtils';
import { loadResolverConfig } from '../resolverConfigLoader';
import { Presenter } from '../presenter';

export interface InteractiveFlowContextApi {
  record: (stateId: string, meta?: Record<string, unknown>) => boolean;
  persist?: () => void;
  context: () => WorkflowContext;
}

export interface InteractiveFlowDeps {
  cwd: string;
  workflowArg?: string;
  approvalResolverPath?: string | null | undefined;
  feedbackResolverPath?: string | null | undefined;
  ctxApi: InteractiveFlowContextApi;
  cancellationToken?: CancellationToken;
}

/**
 * Encapsulates approval and feedback interactions for a state. Delegates to existing
 * handlers but owns persistence and context mutations for deterministic orchestration.
 */
export class InteractiveFlowManager {
  private readonly cwd: string;
  private readonly workflowArg?: string;
  private readonly approvalResolverPath?: string | null | undefined;
  private readonly feedbackResolverPath?: string | null | undefined;
  private readonly ctxApi: InteractiveFlowContextApi;
  private readonly cancellationToken?: CancellationToken;

  constructor(deps: InteractiveFlowDeps) {
    this.cwd = deps.cwd;
    this.workflowArg = deps.workflowArg;
    this.approvalResolverPath = deps.approvalResolverPath;
    this.feedbackResolverPath = deps.feedbackResolverPath;
    this.ctxApi = deps.ctxApi;
    this.cancellationToken = deps.cancellationToken;
  }

  /**
   * Run approval for a state, persist decision and return resolved next state id.
   */
  async handleApproval(
    stateId: string,
    stateDef: StateDef,
    presenter?: Presenter,
  ): Promise<string> {
    const approval = stateDef.config.approval!;

    const approvalOutcome: ApprovalOutcome = await runApprovalStep(
      stateId,
      approval,
      {
        cwd: this.cwd,
        context: this.ctxApi.context(),
        workflowArg: this.workflowArg,
        cancellationToken: this.cancellationToken,
      },
      this.approvalResolverPath,
    );

    if (approvalOutcome.cancelled || this.cancellationToken?.isCancellationRequested) {
      return '';
    }

    const chosen = approvalOutcome.chosen;
    const nextStateId = approvalOutcome.chosen === 'PASSED' ? approval.PASSED : approval.FAILED;

    const approvalMeta: Record<string, unknown> = {
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

    try {
      const enteredAt = presenter?.entry?.enteredAt;
      const elapsedMs = enteredAt ? Date.now() - new Date(enteredAt).getTime() : undefined;
      presenter?.appendStateExit?.(stateDef, chosen, nextStateId, elapsedMs);
      presenter?.render?.();
    } catch {}

    this.ctxApi.record(stateId, approvalMeta);

    const ctx = this.ctxApi.context();
    if (!ctx.approvals) ctx.approvals = {};
    if (!ctx.vars) ctx.vars = {};
    const key = `${stateId}_${approvalOutcome.chosen}`.toUpperCase();
    ctx.approvals[key] = approvalOutcome.reason ?? '';
    ctx.vars[key] = approvalOutcome.reason ?? '';
    if (this.ctxApi.persist) {
      try {
        this.ctxApi.persist();
      } catch {}
    }

    // After approval, collect feedback if configured
    await this.handleFeedback(stateId, stateDef, presenter);

    return nextStateId;
  }

  /**
   * Collect feedback according to state config. Returns a routing target when feedback transitions apply.
   */
  async handleFeedback(
    stateId: string,
    stateDef: StateDef,
    presenter?: Presenter,
  ): Promise<string | null> {
    const fb = stateDef.config.feedback;
    if (!fb) return null;

    const fbStart = Date.now();

    let fbResolver = null;
    if (typeof this.feedbackResolverPath !== 'undefined') {
      fbResolver = loadFeedbackResolver(this.feedbackResolverPath ?? null);
    }

    // Resolve timeout via resolver config if present; fail-open on errors
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

    const val = await handleFeedbackPrompt(fb, fbResolver, timeoutMs, this.cancellationToken);
    if (
      (typeof val !== 'string' && val !== null && val.cancelled) ||
      this.cancellationToken?.isCancellationRequested
    ) {
      return null;
    }
    const fbWait = Date.now() - fbStart;

    const ctx = this.ctxApi.context();
    if (!ctx.vars) ctx.vars = {};

    let feedbackValue = '';
    let feedbackMetadata: string | undefined = undefined;
    if (val === null) {
      feedbackValue = '';
    } else if (typeof val === 'string') {
      feedbackValue = val;
    } else {
      feedbackValue = val.feedback;
      feedbackMetadata = val.metadata;
    }

    const exposeName = fb.expose_var ?? `FEEDBACK_${stateId.toUpperCase()}`;
    if (fb.expose_var) {
      ctx.vars[fb.expose_var] = feedbackValue;
    } else {
      // expose_var should be validated at startup; provide a safe fallback to avoid runtime errors
      ctx.vars[exposeName] = feedbackValue;
    }

    if (!ctx.feedbacks) ctx.feedbacks = {};
    ctx.feedbacks[stateId] = { value: feedbackValue, metadata: feedbackMetadata };

    if (this.ctxApi.persist) {
      try {
        this.ctxApi.persist();
      } catch {}
    }

    const meta: Record<string, unknown> = { feedback: { name: exposeName, value: feedbackValue } };
    if (typeof feedbackMetadata !== 'undefined')
      (meta.feedback as Record<string, unknown>)['metadata'] = feedbackMetadata;
    if (stateDef.config.approval) (meta as Record<string, unknown>)['waitMs'] = fbWait;

    this.ctxApi.record(stateId, meta);

    const transitions = stateDef.config.transitions;
    if (transitions && (transitions as Record<string, string>).next) {
      const next = (transitions as Record<string, string>).next;
      try {
        const enteredAt = presenter?.entry?.enteredAt;
        const elapsedMs = enteredAt ? Date.now() - new Date(enteredAt).getTime() : undefined;
        presenter?.appendStateExit?.(stateDef, 'FEEDBACK', next, elapsedMs);
        presenter?.render?.();
      } catch {}
      return next;
    }

    return null;
  }
}
