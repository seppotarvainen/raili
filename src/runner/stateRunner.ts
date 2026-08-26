import { CancellationToken, StateDef } from '../types';
import type { StateResult } from './runner';

/**
 * Minimal StateRunner interface for prototype refactor.
 * Implementations should execute the state and return a StateResult.
 */
export interface IStateRunner {
  run(
    state: StateDef,
    cwd: string,
    vars?: Record<string, string>,
    workflowArg?: string,
    cancellationToken?: CancellationToken,
  ): Promise<StateResult>;
}
