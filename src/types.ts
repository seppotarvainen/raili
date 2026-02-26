// Shared types for workflow configuration and state machine

// Workflow configuration loaded from workflow.yaml
export type StateType = 'agent' | 'script' | 'command' | 'engine';

export interface ApprovalConfig {
  question: string;
  PASSED: string;
  FAILED: string;
}

export interface StateConfig {
  type: StateType;
  agent?: string;        // For type: agent
  script?: string;       // For type: script
  command?: string;      // For type: command — inline shell command
  directory?: string;    // For type: command — working directory (defaults to cwd)
  prompt?: string;       // Optional prompt for agent
  approval?: ApprovalConfig;
  transitions?: Record<string, string>;
  on?: Record<string, string>;
}

export interface WorkflowConfig {
  initial: string;
  states: Record<string, StateConfig>;
  include?: string[];  // Paths to sub-workflow files, relative to .raili/
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

