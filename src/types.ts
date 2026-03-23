// Shared types for workflow configuration and state machine

// Workflow configuration loaded from workflow.yaml
import { deprecate } from 'node:util';

export type StateType = 'agent' | 'script' | 'command' | 'engine';

export interface OutputConfig {
  store: boolean; // Save output to .raili/outputs/<stateId>.md
  tail?: number; // Keep only the last N lines of output
  marker?: string; // Optional marker string to locate the start of the stored output; default: "OUTPUT:"
}

export interface ApprovalConfig {
  question: string;
  notify?: string; // Optional shell command to run before showing the approval prompt
  PASSED: string;
  FAILED: string;
  multiline?: boolean; // Optional: allow multiline reason input when prompting (terminator: /q)
}

export interface FeedbackConfig {
  // The workflow variable name that will be set with the collected text
  // Optional at the type level; missing expose_var is validated at startup (fail-fast)
  expose_var?: string;
  // Optional question shown to the user. If omitted, a generic prompt is shown.
  question?: string;
  // If true, an empty answer is not allowed and the prompt will repeat until non-empty
  required?: boolean;
  // If true, collect multiple lines until a single line containing '/q' is entered
  multiline?: boolean;
}

export type LearnSource = { output: string } | { var: string };

export interface StateConfig {
  type: StateType;
  notify?: string; // Optional shell command to run when this state is entered
  output?: OutputConfig; // Structured output configuration
  reset_outputs?: string[]; // Clear saved outputs for these state IDs on entry
  max_visits?: { count: number; continue?: string }; // Max visits: object with count and optional continue target (route when exceeded)
  agent?: string; // For type: agent
  script?: string; // For type: script
  command?: string; // For type: command — inline shell command
  directory?: string; // For type: command — working directory (defaults to cwd)
  prompt?: string; // Optional prompt for agent
  args?: string[]; // For type: script — ordered list of arguments forwarded to the script process
  approval?: ApprovalConfig;
  // Feedback block: capture free-form user input and expose as a workflow variable
  feedback?: FeedbackConfig;
  // Optional success flag for terminal (engine) states. When present it will be persisted
  // to .raili/context.json for the state's run. If omitted, context should record null.
  success?: boolean | null;
  // Optional skip target: when set the engine will bypass this state and immediately route to the given state id
  skip?: string;
  transitions?: Record<string, string>;
  on?: Record<string, string>;
  expose?: string[]; // Names to extract from stdout and export as RAILI_VAR_<UPPERCASE>
  learn_from?: LearnSource[]; // Optional: declare persistent learning sources for agent states
}

export interface InputDef {
  name: string;
  description?: string;
  log?: boolean;
}

export interface WorkflowConfig {
  initial: string;
  error?: string; // Optional named error state to route to on unhandled exceptions
  states: Record<string, StateConfig>;
  inputs?: InputDef[]; // Declared inputs — each must include name and description
}

// Runtime state machine (derived from workflow config)
export interface StateDef {
  id: string;
  config: StateConfig;
  transitions: string[]; // All possible next states
}

export interface StateMachine {
  initial: string;
  error?: string; // Optional runtime-resolved error state id
  states: Record<string, StateDef>;
}

// Execution context
interface NotifyMeta {
  command: string;
  success: boolean;
  exitCode?: number;
  stderr?: string;
}

interface ApprovalMeta {
  question: string;
  chosen: 'PASSED' | 'FAILED';
  reason?: string;
  waitMs?: number;
}

export interface StateHistoryEntry {
  state: string;
  enteredAt: string; // ISO timestamp
  // Optional structured metadata about this entry (notify results, approval decisions, etc.)
  meta?: any;
}

export interface WorkflowContext {
  vars?: Record<string, string>; // User-supplied variables (e.g. ticket_id, description)
  approvals?: Record<string, string>; // Approval reasons keyed by <STATE>_<OUTCOME> uppercase
  stateHistory: StateHistoryEntry[];
}

// Parsed CLI/run arguments
export interface RailiRunArgs {
  workflow?: string;
  mode?: 'clean' | 'continue';
  vars: Record<string, string>;
  help?: boolean;
}
