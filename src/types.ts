// Shared types for workflow configuration and state machine

// Workflow configuration loaded from workflow.yaml
export type StateType = 'agent' | 'script' | 'engine';

export interface ApprovalConfig {
  question: string;
  PASSED: string;
  FAILED: string;
}

export interface StateConfig {
  type: StateType;
  agent?: string;        // For type: agent
  script?: string;       // For type: script
  prompt?: string;       // Optional prompt for agent
  approval?: ApprovalConfig;  // For manual approval after this state
  transitions?: Record<string, string>;  // Conditional transitions (e.g., verify state routing)
  on?: Record<string, string>;  // Explicit outcome-based transitions (PASSED, FAILED, etc.)
}

export interface WorkflowConfig {
  initial: string;
  states: Record<string, StateConfig>;
}

// Runtime state machine (derived from workflow config)
export interface StateDef {
  id: string;
  config: StateConfig;
  transitions: string[];  // All possible next states
}

export interface StateMachine {
  initial: string;
  states: Record<string, StateDef>;
}

// Execution context
export interface StateHistoryEntry {
  state: string;
  enteredAt: string;  // ISO timestamp
}

export interface WorkflowContext {
  ticketId?: string;
  description?: string;
  stateHistory: StateHistoryEntry[];
}

