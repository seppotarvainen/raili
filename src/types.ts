// Shared types for workflow configuration and state machine

// Workflow configuration loaded from workflow.yaml
export type StateType = 'agent' | 'script' | 'command' | 'engine';

export interface ApprovalConfig {
  question: string;
  notify?: string;   // Optional shell command to run before showing the approval prompt
  PASSED: string;
  FAILED: string;
}

export interface StateConfig {
  type: StateType;
  notify?: string;       // Optional shell command to run when this state is entered
  store_output?: boolean;          // Save agent output to .raili/outputs/<stateId>.md
  reset_outputs?: string[];        // Clear saved outputs for these state IDs on entry
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

