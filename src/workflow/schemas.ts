// Schema definitions for validating workflow configuration
// These mirror the TypeScript interfaces in types.ts but are enumerable at runtime

export type FieldType = 'string' | 'boolean' | 'number' | 'object' | 'array' | 'record';

import { StateType } from '../types';

export interface FieldSchema {
  required: boolean;
  type: FieldType;
  enum?: string[]; // For restricted value sets
  description?: string;
  validate?: 'mutual-exclusive-with-transitions' | 'on-requires-passed' | 'record-keys-enum'; // Custom validation rule
  recordKeyEnum?: string[]; // If type is 'record', restrict allowed keys to these values
  validForTypes?: StateType[]; // If set, field is only valid for these state types
}

export type ObjectSchema = Record<string, FieldSchema>;

// OutputConfig schema
export const OutputConfigSchema: ObjectSchema = {
  store: {
    required: true,
    type: 'boolean',
    description: 'Save output to .raili/outputs/<stateId>.md',
  },
  tail: {
    required: false,
    type: 'number',
    description: 'Keep only the last N lines of output',
  },
  marker: {
    required: false,
    type: 'string',
    description:
      'Marker string to locate the start of the stored output; first occurrence (case-insensitive) is used.',
  },
  marker_end: {
    required: false,
    type: 'string',
    description:
      'Optional marker string to locate the end of the stored output (first occurrence, case-insensitive). When both marker and marker_end are provided the substring between them is extracted.',
  },
};

// ApprovalConfig schema
export const ApprovalConfigSchema: ObjectSchema = {
  question: {
    required: true,
    type: 'string',
    description: 'Question to ask for approval',
  },
  notify: {
    required: false,
    type: 'string',
    description: 'Optional shell command to run before showing the approval prompt',
  },
  PASSED: {
    required: true,
    type: 'string',
    description: 'Next state if approval is passed',
  },
  FAILED: {
    required: true,
    type: 'string',
    description: 'Next state if approval is failed',
  },
  multiline: {
    required: false,
    type: 'boolean',
    description: 'When true, accept multiline input terminated by a line containing only "/q"',
  },
};

// FeedbackConfig schema
export const FeedbackConfigSchema: ObjectSchema = {
  expose_var: {
    required: true,
    type: 'string',
    description: 'The workflow variable name that will store the collected feedback',
  },
  question: {
    required: false,
    type: 'string',
    description: 'Optional question shown to the user; defaults to a generic prompt when omitted',
  },
  required: {
    required: false,
    type: 'boolean',
    description: 'When true, empty input is rejected and the prompt repeats until non-empty',
  },
  multiline: {
    required: false,
    type: 'boolean',
    description: "When true, accept multiline input terminated by a line containing only '/q'",
  },
};

// StateConfig schema
export const StateConfigSchema: ObjectSchema = {
  type: {
    required: true,
    type: 'string',
    enum: ['agent', 'script', 'command', 'engine', 'group'],
    description: 'Type of state handler',
  },
  notify: {
    required: false,
    type: 'string',
    description: 'Optional shell command to run when this state is entered',
  },
  output: {
    required: false,
    type: 'object',
    description: 'Structured output configuration (store, tail, filter patterns)',
  },
  reset_outputs: {
    required: false,
    type: 'array',
    description: 'Clear saved outputs for these state IDs on entry',
  },
  max_visits: {
    required: false,
    type: 'object',
    description:
      'Object with count and optional continue target. Example: { count: 5, continue: "done" }',
  },
  agent: {
    required: false,
    type: 'string',
    description: 'Agent name (for type: agent)',
    validForTypes: ['agent'],
  },
  script: {
    required: false,
    type: 'string',
    description: 'Script path (for type: script)',
    validForTypes: ['script'],
  },
  args: {
    required: false,
    type: 'array',
    description: 'Arguments for script (for type: script)',
    validForTypes: ['script'],
  },
  command: {
    required: false,
    type: 'string',
    description: 'Inline shell command (for type: command)',
    validForTypes: ['command'],
  },
  // Path to sub-workflow YAML (for type: group)
  group: {
    required: false,
    type: 'string',
    description: 'Relative path to sub-workflow YAML file (for type: group)',
    validForTypes: ['group'],
  },
  directory: {
    required: false,
    type: 'string',
    description: 'Working directory for command execution',
    validForTypes: ['command'],
  },
  expose: {
    required: false,
    type: 'array',
    description:
      'List of variable names to extract from stdout and expose as RAILI_VAR_<UPPERCASE>',
    validForTypes: ['script', 'command'],
  },
  prompt: {
    required: false,
    type: 'string',
    description: 'Optional prompt for agent',
    validForTypes: ['agent'],
  },
  teach: {
    required: false,
    type: 'record',
    description:
      'Map of <agentId> -> list of sources to teach (objects like {output: stateId} or {var: "${VAR_NAME}"})',
    validForTypes: ['agent', 'script', 'command', 'engine', 'group'],
  },
  approval: {
    required: false,
    type: 'object',
    description: 'Approval configuration',
  },
  feedback: {
    required: false,
    type: 'object',
    description: 'Feedback configuration (collect free-form user input and expose as a variable)',
  },
  success: {
    required: false,
    type: 'boolean',
    description:
      'Optional success flag for terminal (engine) states; persisted to context.json when present',
    validForTypes: ['engine'],
  },
  out: {
    required: false,
    type: 'boolean',
    description:
      "Optional 'out' flag to mark sub-workflow exit points; sub-workflows must declare at least one state with out: true",
  },
  // Optional skip target: bypass this state and immediately route to the specified state id without running handlers
  skip: {
    required: false,
    type: 'string',
    description: 'Optional state id to immediately route to without executing this state',
  },
  continue: {
    required: false,
    type: 'string',
    description:
      "Optional unconditional next state id. Mutually exclusive with 'on', 'transitions', and 'approval'",
  },
  transitions: {
    required: false,
    type: 'record',
    description: 'State transitions keyed by output/result',
    validate: 'mutual-exclusive-with-transitions',
  },
  on: {
    required: false,
    type: 'record',
    description: 'Binary outcomes (PASSED/FAILED) for exit code-based routing',
    validate: 'on-requires-passed',
    recordKeyEnum: ['PASSED', 'FAILED'],
  },
};

// WorkflowConfig schema
export const WorkflowConfigSchema: ObjectSchema = {
  initial: {
    required: true,
    type: 'string',
    description: 'ID of the initial state',
  },
  error: {
    required: false,
    type: 'string',
    description: 'Optional ID of the error state to route to on unhandled exceptions',
  },
  states: {
    required: true,
    type: 'record',
    description: 'State definitions keyed by state ID',
  },
  inputs: {
    required: false,
    type: 'array',
    description:
      'Declared input names — raili prompts for these on a clean run. Items may be strings or objects {name, description}.',
  },
};
