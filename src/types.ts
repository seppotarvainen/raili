// Shared types for the fixed state machine

export type StateId = 'init' | 'analyze' | 'plan' | 'execute' | 'test' | 'verify' | 'archive' | 'done' | 'failed';

export interface StateDef {
  id: StateId;
  // Explicit allowed transitions from this state
  transitions: StateId[];
}

export interface StateMachine {
  initial: StateId;
  states: Record<StateId, StateDef>;
}

