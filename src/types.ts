// Shared types for workflow configuration and state machine

// Workflow configuration loaded from workflow.yaml
import {deprecate} from "node:util";

export type StateType = 'agent' | 'script' | 'command' | 'engine';

export interface OutputConfig {
  store: boolean;                    // Save output to .raili/outputs/<stateId>.md
  tail?: number;                     // Keep only the last N lines of output
  include_search_pattern?: string;   // Regex pattern to search for matching lines
  include_after?: number;            // Include N lines after each matched line
}

export interface ApprovalConfig {
  question: string;
  notify?: string;   // Optional shell command to run before showing the approval prompt
  PASSED: string;
  FAILED: string;
}

export interface StateConfig {
  type: StateType;
  notify?: string;       // Optional shell command to run when this state is entered
  output?: OutputConfig;           // Structured output configuration
  reset_outputs?: string[];        // Clear saved outputs for these state IDs on entry
  max_visits?: number;             // Throw if this state is entered more than N times
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
  error?: string; // Optional named error state to route to on unhandled exceptions
  states: Record<string, StateConfig>;
  inputs?: string[];       // Declared input names — raili prompts for these on a clean run
  include?: string[];      // Paths to sub-workflow files, relative to .raili/
}

// Runtime state machine (derived from workflow config)
export interface StateDef {
  id: string;
  config: StateConfig;
  transitions: string[];  // All possible next states
}

export interface StateMachine {
  initial: string;
  error?: string; // Optional runtime-resolved error state id
  states: Record<string, StateDef>;
}

// Execution context
export interface StateHistoryEntry {
  state: string;
  enteredAt: string;  // ISO timestamp
}

export interface WorkflowContext {
  vars?: Record<string, string>;   // User-supplied variables (e.g. ticket_id, description)
  stateHistory: StateHistoryEntry[];
}
