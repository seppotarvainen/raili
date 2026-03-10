import { StateMachine, WorkflowContext } from '../types';
import { AgentRegistry } from '../agentRegistry';
import { ScriptRegistry } from '../scriptRegistry';
import { addStateToHistory, saveContext, getCurrentState } from '../context';
import { runAgentState } from './AgentStateRunner';
import { runScriptState } from './ScriptStateRunner';
import { runCommandState } from './CommandStateRunner';
import { runApprovalStep } from './ApproveStateRunner';
import { runNotify } from '../handlers/notifyHandler';
import { clearAgentOutputs } from '../outputStore';
import colors from 'colors/safe';

/** Outcome string returned by every state runner: 'PASSED', 'FAILED', or a named transitions key */
export type StateOutcome = string;

export interface EngineConfig {
  stateMachine: StateMachine;
  agentRegistry: AgentRegistry;
  scriptRegistry: ScriptRegistry;
  context: WorkflowContext;
  cwd: string;
}

/**
 * Resolves the next state from a state's routing config and an outcome key.
 * Throws immediately if outcome is not mapped (fail-fast).
 */
function resolveNextState(stateId: string, routing: Record<string, string>, outcome: string): string {
  const next = routing[outcome];
  if (!next) {
    throw new Error(
      `State '${stateId}': outcome '${outcome}' has no matching transition (defined: ${Object.keys(routing).join(', ')})`
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
  private readonly visitCounts = new Map<string, number>();

  constructor(config: EngineConfig) {
    this.stateMachine = config.stateMachine;
    this.agentRegistry = config.agentRegistry;
    this.scriptRegistry = config.scriptRegistry;
    this.context = config.context;
    this.cwd = config.cwd;
  }

  /**
   * Run the workflow from the current (or initial) state until a terminal state is reached.
   */
  async run(): Promise<void> {
    const currentStateId = getCurrentState(this.context) ?? this.stateMachine.initial;

    // Record initial state if history is empty
    if (this.context.stateHistory.length === 0) {
      this.context = addStateToHistory(this.context, currentStateId);
      saveContext(this.cwd, this.context);
    }

    let stateId = currentStateId;

    while (true) {
      try {
        const stateDef = this.stateMachine.states[stateId];
        if (!stateDef) {
          throw new Error(`Engine: state '${stateId}' not found in state machine`);
        }

        const { config } = stateDef;

        // On state entry: enforce max_visits first
        if (config.max_visits !== undefined) {
          const visits = (this.visitCounts.get(stateId) ?? 0) + 1;
          this.visitCounts.set(stateId, visits);
          if (visits > config.max_visits) {
            throw new Error(
              `State '${stateId}' exceeded max_visits limit of ${config.max_visits}`
            );
          }
        }

        // On state entry: clear outputs and fire notify before anything else
        if (config.reset_outputs?.length) {
          clearAgentOutputs(this.cwd, config.reset_outputs);
        }

        if (config.notify) {
          await runNotify(config.notify, this.cwd);
        }

        // Terminal state: no routing defined, stop execution
        if (!config.on && !config.transitions && !config.approval) {
          console.log(`✓ Reached terminal state: ${stateId}`);
          break;
        }

        console.log(colors.cyan(`→ Executing state: ${stateId} (type: ${config.type})`));


        let outcome: string;

        // Execute the state handler
        if (config.type === 'agent') {
          outcome = await runAgentState(stateDef, this.agentRegistry, this.cwd);
        } else if (config.type === 'script') {
          outcome = await runScriptState(stateDef, this.scriptRegistry, this.cwd);
        } else if (config.type === 'command') {
          outcome = await runCommandState(stateDef, this.cwd);
        } else {
          // type: engine — no side effects, falls through to approval or transitions
          outcome = 'PASSED';
        }

        // If the state has an approval block, run it before routing
        if (config.approval) {
          const approvalOutcome = await runApprovalStep(stateId, config.approval, {
            cwd: this.cwd,
          });
          const nextStateId = resolveNextState(stateId, {
            PASSED: config.approval.PASSED,
            FAILED: config.approval.FAILED,
          }, approvalOutcome);

          console.log(`  approval: ${approvalOutcome} → ${nextStateId}`);
          this.context = addStateToHistory(this.context, nextStateId);
          saveContext(this.cwd, this.context);
          stateId = nextStateId;
          continue;
        }

        // Route via `on:` or `transitions:`
        const routing = config.on ?? config.transitions!;
        const nextStateId = resolveNextState(stateId, routing, outcome);

        console.log(`  → ${nextStateId}`);
        this.context = addStateToHistory(this.context, nextStateId);
        saveContext(this.cwd, this.context);
        stateId = nextStateId;
      } catch (err) {
        // Unhandled exception during state execution/routing — route to error state if configured
        if (this.stateMachine.error) {
          const errStateId = this.stateMachine.error;
          const errDef = this.stateMachine.states[errStateId];
          if (!errDef) {
            throw new Error(`Engine encountered error and declared error state '${errStateId}' not found`);
          }
          // On entry: clear outputs and run notify for the error state (like normal entry)
          const errConfig = errDef.config;
          if (errConfig.reset_outputs?.length) {
            clearAgentOutputs(this.cwd, errConfig.reset_outputs);
          }
          if (errConfig.notify) {
            // best-effort notify before exiting
            try { await runNotify(errConfig.notify, this.cwd); } catch {}
          }

          // Record error state and persist context, then stop (error state must be terminal)
          this.context = addStateToHistory(this.context, errStateId);
          saveContext(this.cwd, this.context);
          console.log(`! Engine: unhandled error occurred — routed to error state: ${errStateId}`);
          return;
        }
        // Re-throw if no error state configured
        throw err;
      }
    }
  }
}
