// Shared types for workflow configuration and state machine

// Workflow configuration loaded from workflow.yaml

export type StateType = 'agent' | 'script' | 'command' | 'engine' | 'group';

export interface OutputConfig {
  store: boolean; // Save output to .raili/outputs/<stateId>.md
  tail?: number; // Keep only the last N lines of output
  marker?: string; // Optional marker string to locate the start of the stored output (case-insensitive)
  marker_end?: string; // Optional marker string to locate the end of the stored output (first occurrence, case-insensitive)
  /**
   * Number of latest runs' stored outputs to inject into prompts. Must be >= 1.
   * When omitted, all stored outputs are considered.
   */
  use_latest?: number;
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

/**
 * LearnSource indicates a source of learnings for an agent. The optional `scope`
 * determines where the learning is stored or read from. Default = 'global'.
 */
export type LearnSource =
  | { output: string; scope?: 'global' | 'workflow' }
  | { var: string; scope?: 'global' | 'workflow' };

export interface StateConfig {
  type: StateType;
  notify?: string; // Optional shell command to run when this state is entered
  output?: OutputConfig; // Structured output configuration
  reset_outputs?: string[]; // Clear saved outputs for these state IDs on entry
  reset_max_visits?: string[]; // List of state IDs whose max_visits counter should be reset when this state is entered
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
  continue?: string;
  transitions?: Record<string, string>;
  on?: Record<string, string>;
  expose?: string[]; // Names to extract from stdout and export as RAILI_VAR_<UPPERCASE>
  teach?: Record<string, LearnSource[]>; // Optional: map agentId -> list of learning sources to append to agents
  // Group-specific property: path to sub-workflow YAML file (relative to workflow dir)
  group?: string;
  // Marks exit points inside sub-workflow fragments; required at least once inside a sub-workflow
  out?: boolean;
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

export interface StateMeta {
  notify?: NotifyMeta;
  approval?: ApprovalMeta;
  success?: boolean | null;
  /** ISO timestamp recorded when execution of this state is cancelled. */
  cancelled?: string;
  waitMs?: number;
  // Allow additional arbitrary metadata keys for future extensions
  [key: string]: unknown;
}

export interface StateHistoryEntry {
  state: string;
  enteredAt: string; // ISO timestamp
  // Structured metadata about this entry (notify results, approval decisions, etc.)
  meta?: StateMeta;
}

export interface WorkflowContext {
  vars?: Record<string, string>; // User-supplied variables (e.g. ticket_id, description)
  approvals?: Record<string, string>; // Approval reasons keyed by <STATE>_<OUTCOME> uppercase
  feedbacks?: Record<string, { value: string; metadata?: string }>;
  stateHistory: StateHistoryEntry[];
}

/**
 * Coordinates a run-scoped cancellation request between the CLI and handlers.
 * Implementations own the cancellation state and notify listeners while the
 * runner and handlers only depend on this contract.
 */
export interface CancellationToken {
  readonly isCancellationRequested: boolean;
  onCancellationRequested(listener: () => void): () => void;
}

export interface CancellationController extends CancellationToken {
  requestCancellation(): void;
}

// Token usage parsed from copilot CLI output. Numeric fields are absolute integers.
export interface TokenUsage {
  input: number;
  cached?: number;
  output: number;
  input_display?: string;
  cached_display?: string;
  output_display?: string;
  ai_display?: string;
  ai_credits?: number;
  ai_time?: number;
}


export type TriggerFunction = () => Promise<Record<string, string> | null>;

// Resolver configuration for approval/feedback/trigger behavior
export interface ResolverConfig {
  trigger?: {
    interval?: number;       // Poll interval in seconds (default: 15)
    timeout?: number;        // Failure timeout in seconds (default: 600)
    retry_interval?: number; // Backoff retry interval in seconds (default: 5)
  };
  approval?: {
    timeout?: number; // Timeout in seconds (default: 3600, no retry)
  };
  feedback?: {
    timeout?: number; // Timeout in seconds (default: 3600)
  };
}


// Inputs provided to approval resolver functions
export interface ApprovalResolverInput {
  // The state id for which approval is being resolved
  stateId?: string;
  // Optional human-readable question or prompt presented to user/resolver
  question?: string;
  // Optional short state name
  stateName?: string;
  // Shortcut vars map (may be provided by callers)
  vars?: Record<string, string> | undefined;
  // Optional path to previous output that resolver may inspect
  outputPath?: string | null;
  // Absolute workflow directory (e.g. .raili/main)
  workflowDir?: string;
  // Current persisted workflow context
  context?: WorkflowContext;
}

// Result object for approval resolvers
export interface ApprovalResolverResult {
  outcome: 'PASSED' | 'FAILED';
  reason?: string;
}

/**
 * Examples:
 * // Old-style resolver returning a string
 * export default async function (input: ApprovalResolverInput) { return 'PASSED'; }
 * // New-style resolver returning an object
 * export default async function (input: ApprovalResolverInput) { return { outcome: 'FAILED', reason: 'Missing tests' }; }
 */
type ApprovalResolverFn = (
  input: ApprovalResolverInput,
) => Promise<ApprovalResolverResult | 'PASSED' | 'FAILED'> | ApprovalResolverResult | 'PASSED' | 'FAILED';

// Inputs provided to feedback resolver functions
export interface FeedbackResolverInput {
  // Optional prompt text that the resolver may present or use
  prompt?: string;
  // Optional short state name
  stateName?: string;
  // Absolute workflow directory (e.g. .raili/main)
  workflowDir?: string;
  // Current persisted workflow context
  context?: WorkflowContext;
  // The feedback configuration block from the state
  config?: FeedbackConfig;
}

// Result object for feedback resolvers
export interface FeedbackResolverResult {
  feedback: string;
  metadata?: string;
  cancelled?: boolean;
}

/**
 * Examples:
 * // Old-style resolver returning a string
 * export default async function (input: FeedbackResolverInput) { return 'Looks good'; }
 * // New-style resolver returning an object
 * export default async function (input: FeedbackResolverInput) { return { feedback: 'Looks good', metadata: 'auto' }; }
 */
type FeedbackResolverFn = (
  input: FeedbackResolverInput,
) => Promise<FeedbackResolverResult | string | null> | FeedbackResolverResult | string | null;

// Vars resolver types
export interface VarsResolverInput {
  namedArgs?: Record<string, string>;
  positionalArgs?: string[];
  workflowDir?: string;
  context?: WorkflowContext;
}

export type VarsResolverResult = Record<string, string>;

export type VarsResolverFn = (
  input: VarsResolverInput,
) => Promise<VarsResolverResult | null> | VarsResolverResult | null;

// Parsed CLI/run arguments
export interface RailiRunArgs {
  workflow?: string;
  mode?: 'clean' | 'continue';
  next?: number;
  rollback?: string;
  vars: Record<string, string>;
  resolveVars?: string[]; // Raw tokens passed to --resolve-vars or [] when flag present without args
  help?: boolean;
  dryRun?: boolean;
  verbose?: boolean;
}

// Graph types: nodes, edges, and graph model used by CLI utilities
export interface GraphNode {
  id: string;
  type: StateType;
  config: StateConfig;
}

export interface GraphEdge {
  from: string;
  to: string;
  outcome?: string;
  isDefault?: boolean;
}

export interface Graph {
  initial?: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
  terminals: string[];
}
