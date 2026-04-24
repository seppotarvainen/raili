import { StateDef, StateMachine, WorkflowContext } from '../types';
import { resolveTransition } from './transition';
import { Presenter } from '../presenter';

export interface RoutingDeps {
  runNotify?: (cmd: string, cwd: string, vars?: Record<string, string>) => Promise<any>;
  clearAgentOutputs?: (cwd: string, ids: string[], workflowArg?: string) => void;
  cwd: string;
  workflowArg?: string;
}

/**
 * Responsible for skip evaluation, outcome routing and error routing.
 * Keeps routing decisions deterministic and fail-fast.
 */
export class RoutingManager {
  private readonly runNotify?: RoutingDeps['runNotify'];
  private readonly clearAgentOutputs?: RoutingDeps['clearAgentOutputs'];
  private readonly cwd: string;
  private readonly workflowArg?: string;

  constructor(deps: RoutingDeps) {
    this.runNotify = deps.runNotify;
    this.clearAgentOutputs = deps.clearAgentOutputs;
    this.cwd = deps.cwd;
    this.workflowArg = deps.workflowArg;
  }

  evaluateSkip(stateId: string, stateDef: StateDef, stateMachine: StateMachine): string | null {
    const skip = (stateDef.config as any).skip;
    if (!skip) return null;
    const target = skip as string;
    if (!(target in stateMachine.states)) {
      throw new Error(`State '${stateId}': skip target '${target}' not found in state machine`);
    }
    return target;
  }

  routeToNext(
    stateId: string,
    stateDef: StateDef,
    outcome: string,
    stateMachine: StateMachine,
    presenter?: Presenter,
  ): string {
    const cont =
      (stateDef.config as any).continue ?? ((stateDef as any).continue as string | undefined);
    if (cont) {
      if (!(cont in stateMachine.states)) {
        throw new Error(`State '${stateId}': continue target '${cont}' not found in state machine`);
      }
      const nextStateId = cont;
      try {
        const enteredAt = presenter?.entry?.enteredAt;
        const elapsedMs = enteredAt ? Date.now() - new Date(enteredAt).getTime() : undefined;
        presenter?.appendStateExit?.(stateDef, 'CONTINUE', nextStateId, elapsedMs);
        presenter?.render?.();
      } catch {}
      return nextStateId;
    }

    const routing = stateDef.config.on ?? stateDef.config.transitions;
    const next = resolveTransition(routing as any, outcome as any);
    if (!next) {
      throw new Error(
        `State '${stateId}': outcome '${outcome}' has no matching transition (defined: ${
          routing ? Object.keys(routing).join(', ') : ''
        })`,
      );
    }
    if (!(next in stateMachine.states)) {
      throw new Error(
        `State '${stateId}': resolved next state '${next}' not found in state machine`,
      );
    }

    try {
      const enteredAt = presenter?.entry?.enteredAt;
      const elapsedMs = enteredAt ? Date.now() - new Date(enteredAt).getTime() : undefined;
      presenter?.appendStateExit?.(stateDef, outcome, next, elapsedMs);
      presenter?.render?.();
    } catch {}

    return next;
  }

  async routeError(
    err: unknown,
    stateMachine: StateMachine,
    context: WorkflowContext,
  ): Promise<boolean> {
    if (!stateMachine.error) return false;
    const errStateId = stateMachine.error;
    const errDef = stateMachine.states[errStateId];
    if (!errDef) {
      throw new Error(
        `RoutingManager encountered error and declared error state '${errStateId}' not found`,
      );
    }

    const errConfig = errDef.config;
    if (errConfig.reset_outputs?.length && this.clearAgentOutputs) {
      try {
        this.clearAgentOutputs(this.cwd, errConfig.reset_outputs, this.workflowArg);
      } catch {}
    }

    if (errConfig.notify && this.runNotify) {
      try {
        await this.runNotify(errConfig.notify, this.cwd, context.vars ?? {});
      } catch {}
    }

    // Note: recording the history entry is left to the caller (Runner) who owns context/history.
    return true;
  }
}
