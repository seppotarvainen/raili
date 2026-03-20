import { StateMachine, WorkflowContext } from '../types';
import { AgentRegistry } from '../agentRegistry';
import { ScriptRegistry } from '../scriptRegistry';
import { addStateToHistory, saveContext, getCurrentState } from '../context';
import { runAgentState } from './AgentStateRunner';
import { runScriptState } from './ScriptStateRunner';
import { runCommandState } from './CommandStateRunner';
import { runApprovalStep, ApprovalOutcome } from './ApproveStateRunner';
import { runNotify, NotifyResult } from '../handlers/notifyHandler';
import { clearAgentOutputs } from '../outputStore';
import { resolveTransition } from '../transition';
import colors from 'colors/safe';
import { handleFeedbackPrompt } from '../handlers/manualHandler';

/** Result returned by every state runner: outcome and optional exports */
export type StateResult = { outcome: string; exports?: Record<string, string> };

export interface EngineConfig {
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

export class Engine {
  private readonly stateMachine: StateMachine;
  private readonly agentRegistry: AgentRegistry;
  private readonly scriptRegistry: ScriptRegistry;
  private context: WorkflowContext;
  private readonly cwd: string;
  private readonly workflowArg?: string;
  private readonly visitCounts = new Map<string, number>();

  constructor(config: EngineConfig) {
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

  /**
   * Run the workflow from the current (or initial) state until a terminal state is reached.
   */
  async run(): Promise<void> {
    const currentStateId = getCurrentState(this.context) ?? this.stateMachine.initial;

    // Record initial state if history is empty
    if (this.context.stateHistory.length === 0) {
      const newCtx = addStateToHistory(this.context, currentStateId);
      if (newCtx) this.context = newCtx;
      saveContext(this.cwd, this.context, this.workflowArg);
    }

    let stateId = currentStateId;

    while (true) {
      try {
        const stateDef = this.stateMachine.states[stateId];
        if (!stateDef) {
          throw new Error(`Engine: state '${stateId}' not found in state machine`);
        }

        const { config } = stateDef;

        // If state is configured to be skipped, immediately route to its target
        if ((config as any).skip) {
          const target = (config as any).skip as string;
          if (!(target in this.stateMachine.states)) {
            throw new Error(
              `State '${stateId}': skip target '${target}' not found in state machine`,
            );
          }

          // Record skip in state history (skipped states do not run notify/reset_outputs or increment visits)
          const newCtxSkip = addStateToHistory(this.context, stateId, { skipped: { target } });
          if (newCtxSkip) this.context = newCtxSkip;
          saveContext(this.cwd, this.context, this.workflowArg);

          // Route to target state
          stateId = target;
          continue;
        }

        // On state entry: enforce max_visits first
        if (config.max_visits !== undefined) {
          const visits = (this.visitCounts.get(stateId) ?? 0) + 1;
          this.visitCounts.set(stateId, visits);
          if (visits > config.max_visits) {
            throw new Error(`State '${stateId}' exceeded max_visits limit of ${config.max_visits}`);
          }
        }

        // On state entry: clear outputs and fire notify before anything else
        if (config.reset_outputs?.length) {
          clearAgentOutputs(this.cwd, config.reset_outputs, this.workflowArg);
        }

        // Ensure the current state is present in history (append if not)
        const lastState = this.context.stateHistory[this.context.stateHistory.length - 1];
        if (!lastState || lastState.state !== stateId) {
          const newCtx = addStateToHistory(this.context, stateId);
          if (newCtx) this.context = newCtx;
          saveContext(this.cwd, this.context, this.workflowArg);
        }

        let notifyMeta: NotifyResult | undefined;
        if (config.notify) {
          notifyMeta = await runNotify(config.notify, this.cwd, this.context?.vars ?? {});
          // Persist notify result into the last history entry's meta
          const newCtxNotify = addStateToHistory(this.context, stateId, { notify: notifyMeta });
          if (newCtxNotify) this.context = newCtxNotify;
          saveContext(this.cwd, this.context, this.workflowArg);
        }

        // Terminal state: no routing defined, persist optional success flag and stop execution
        if (!config.on && !config.transitions && !config.approval) {
          const successValue = config.success === undefined ? null : !!config.success;
          const newCtxTerm = addStateToHistory(this.context, stateId, { success: successValue });
          if (newCtxTerm) this.context = newCtxTerm;
          saveContext(this.cwd, this.context, this.workflowArg);
          console.log(`✓ Reached terminal state: ${stateId}`);
          break;
        }

        console.log(colors.cyan(`→ Executing state: ${stateId} (type: ${config.type})`));

        // Execute the state handler and capture exports if any
        let stateResult = { outcome: 'PASSED' } as StateResult;

        if (config.type === 'agent') {
          stateResult = await runAgentState(
            stateDef,
            this.agentRegistry,
            this.cwd,
            this.context?.vars,
            this.workflowArg,
          );
        } else if (config.type === 'script') {
          stateResult = await runScriptState(
            stateDef,
            this.scriptRegistry,
            this.cwd,
            this.context?.vars,
            this.workflowArg,
          );
        } else if (config.type === 'command') {
          stateResult = await runCommandState(
            stateDef,
            this.cwd,
            this.context?.vars,
            this.workflowArg,
          );
        } else {
          // type: engine — no side effects
          stateResult = { outcome: 'PASSED' };
        }

        // Handle exported variables from script/command.
        // When config.expose is declared, ALWAYS validate that every listed variable
        // was produced — even if the exports map came back empty.
        if (config.expose && config.expose.length > 0) {
          if (!this.context.vars) this.context.vars = {};
          for (const name of config.expose) {
            const val = stateResult.exports?.[name];
            if (val === undefined || val === null || String(val).trim() === '') {
              throw new Error(
                `State '${stateId}': exposed variable '${name}' was not produced by the state`,
              );
            }
            this.context.vars[name] = String(val);
          }
          saveContext(this.cwd, this.context, this.workflowArg);
        } else if (stateResult.exports && Object.keys(stateResult.exports).length > 0) {
          // No explicit expose list — merge any ad-hoc exports without strict validation
          if (!this.context.vars) this.context.vars = {};
          for (const [k, v] of Object.entries(stateResult.exports)) {
            this.context.vars[k] = v;
          }
          saveContext(this.cwd, this.context, this.workflowArg);
        }

        const outcome = stateResult.outcome;

        // If the state has an approval block, run it before routing
        if (config.approval) {
          const approvalOutcome: ApprovalOutcome = await runApprovalStep(stateId, config.approval, {
            cwd: this.cwd,
            context: this.context,
          });
          const nextStateId = resolveNextState(
            stateId,
            {
              PASSED: config.approval.PASSED,
              FAILED: config.approval.FAILED,
            },
            approvalOutcome.chosen,
          );

          console.log(`  approval: ${approvalOutcome.chosen} → ${nextStateId}`);
          // Persist approval decision on the current state's history entry (approval asked/executed here)
          const newCtxApproval = addStateToHistory(this.context, stateId, {
            approval: {
              question: approvalOutcome.question,
              chosen: approvalOutcome.chosen,
              reason: approvalOutcome.reason,
              notify: approvalOutcome.notify ?? undefined,
            },
          });
          if (newCtxApproval) this.context = newCtxApproval;

          // Persist approval reason into dedicated approvals map and mirror into vars for env exposure
          if (!this.context.approvals) this.context.approvals = {};
          if (!this.context.vars) this.context.vars = {};
          // Only persist non-empty reasons (avoid creating empty entries for PASSED)
          if (
            approvalOutcome.chosen === 'FAILED' &&
            approvalOutcome.reason &&
            approvalOutcome.reason.trim() !== ''
          ) {
            const key = `${stateId}_${approvalOutcome.chosen}`.toUpperCase();
            this.context.approvals[key] = approvalOutcome.reason;
            this.context.vars[key] = approvalOutcome.reason;
          }

          saveContext(this.cwd, this.context, this.workflowArg);

          // After approval, optionally collect feedback if configured on the state
          if ((config as any).feedback) {
            const fb = (config as any).feedback as any;
            const val = await handleFeedbackPrompt(fb);
            if (!this.context.vars) this.context.vars = {};
            this.context.vars[fb.expose_var] = val;
            saveContext(this.cwd, this.context, this.workflowArg);
            const newCtxFb = addStateToHistory(this.context, stateId, {
              feedback: { name: fb.expose_var, value: val },
            });
            if (newCtxFb) this.context = newCtxFb;
          }

          stateId = nextStateId;
          continue;
        }

        // If no approval present but feedback configured, collect feedback after state execution
        if ((config as any).feedback) {
          const fb = (config as any).feedback as any;
          const val = await handleFeedbackPrompt(fb);
          if (!this.context.vars) this.context.vars = {};
          this.context.vars[fb.expose_var] = val;
          saveContext(this.cwd, this.context, this.workflowArg);
          const newCtxFb = addStateToHistory(this.context, stateId, {
            feedback: { name: fb.expose_var, value: val },
          });
          if (newCtxFb) this.context = newCtxFb;

          // If feedback is present and transitions include a 'next' mapping, route directly to it.
          // This allows simple feedback states to declare 'transitions:\n  next: <state>'
          // and have the engine continue to that state after collecting feedback.
          if (config.transitions && (config.transitions as any).next) {
            const next = (config.transitions as any).next;
            console.log(`  → ${next}`);
            const newCtxRoute2 = addStateToHistory(this.context, next);
            if (newCtxRoute2) this.context = newCtxRoute2;
            saveContext(this.cwd, this.context, this.workflowArg);
            stateId = next;
            continue;
          }
        }

        // Route via `on:` or `transitions:`
        const routing = config.on ?? config.transitions!;
        const nextStateId = resolveNextState(stateId, routing, outcome);

        console.log(`  → ${nextStateId}`);
        const newCtxRoute = addStateToHistory(this.context, nextStateId);
        if (newCtxRoute) this.context = newCtxRoute;
        saveContext(this.cwd, this.context, this.workflowArg);
        stateId = nextStateId;
      } catch (err) {
        // Unhandled exception during state execution/routing — route to error state if configured
        if (this.stateMachine.error) {
          const errStateId = this.stateMachine.error;
          const errDef = this.stateMachine.states[errStateId];
          if (!errDef) {
            throw new Error(
              `Engine encountered error and declared error state '${errStateId}' not found`,
            );
          }
          // On entry: clear outputs and run notify for the error state (like normal entry)
          const errConfig = errDef.config;
          if (errConfig.reset_outputs?.length) {
            clearAgentOutputs(this.cwd, errConfig.reset_outputs, this.workflowArg);
          }
          if (errConfig.notify) {
            // best-effort notify before exiting
            try {
              const n = await runNotify(errConfig.notify, this.cwd, this.context.vars ?? {});
              const newCtxErrNotify = addStateToHistory(this.context, errStateId, { notify: n });
              if (newCtxErrNotify) this.context = newCtxErrNotify;
              saveContext(this.cwd, this.context, this.workflowArg);
            } catch {}
          }

          // Record error state and persist context, then stop (error state must be terminal)
          const newCtxErr = addStateToHistory(this.context, errStateId);
          if (newCtxErr) this.context = newCtxErr;
          saveContext(this.cwd, this.context, this.workflowArg);
          console.log(`! Engine: unhandled error occurred — routed to error state: ${errStateId}`);
          return;
        }
        // Re-throw if no error state configured
        throw err;
      }
    }
  }
}
