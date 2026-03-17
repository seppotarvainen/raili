// Schema definitions for validating workflow configuration
// These mirror the TypeScript interfaces in types.ts but are enumerable at runtime

export type FieldType = 'string' | 'boolean' | 'number' | 'object' | 'array' | 'record';

export interface FieldSchema {
  required: boolean;
  type: FieldType;
  enum?: string[];  // For restricted value sets
  description?: string;
  validate?: 'mutual-exclusive-with-transitions' | 'on-requires-passed' | 'record-keys-enum';  // Custom validation rule
  recordKeyEnum?: string[];  // If type is 'record', restrict allowed keys to these values
  validForTypes?: ('agent' | 'script' | 'command' | 'engine')[];  // If set, field is only valid for these state types
}

export interface ObjectSchema {
  [key: string]: FieldSchema;
}

// OutputConfig schema
export const OutputConfigSchema: ObjectSchema = {
  store: {
    required: true,
    type: 'boolean',
    description: 'Save output to .raili/outputs/<stateId>.md'
  },
  tail: {
    required: false,
    type: 'number',
    description: 'Keep only the last N lines of output'
  },
  include_search_pattern: {
    required: false,
    type: 'string',
    description: 'Regex pattern to search for matching lines'
  },
  include_after: {
    required: false,
    type: 'number',
    description: 'Include N lines after each matched line'
  }
};

// ApprovalConfig schema
export const ApprovalConfigSchema: ObjectSchema = {
  question: {
    required: true,
    type: 'string',
    description: 'Question to ask for approval'
  },
  notify: {
    required: false,
    type: 'string',
    description: 'Optional shell command to run before showing the approval prompt'
  },
  PASSED: {
    required: true,
    type: 'string',
    description: 'Next state if approval is passed'
  },
  FAILED: {
    required: true,
    type: 'string',
    description: 'Next state if approval is failed'
  },
  multiline: {
    required: false,
    type: 'boolean',
    description: 'When true, accept multiline input terminated by a line containing only "/q"'
  }
};

// StateConfig schema
export const StateConfigSchema: ObjectSchema = {
  type: {
    required: true,
    type: 'string',
    enum: ['agent', 'script', 'command', 'engine'],
    description: 'Type of state handler'
  },
  notify: {
    required: false,
    type: 'string',
    description: 'Optional shell command to run when this state is entered'
  },
  output: {
    required: false,
    type: 'object',
    description: 'Structured output configuration (store, tail, filter patterns)'
  },
  reset_outputs: {
    required: false,
    type: 'array',
    description: 'Clear saved outputs for these state IDs on entry'
  },
  max_visits: {
    required: false,
    type: 'number',
    description: 'Throw if this state is entered more than N times'
  },
  agent: {
    required: false,
    type: 'string',
    description: 'Agent name (for type: agent)',
    validForTypes: ['agent']
  },
  script: {
    required: false,
    type: 'string',
    description: 'Script path (for type: script)',
    validForTypes: ['script']
  },
  args: {
    required: false,
    type: 'array',
    description: 'Arguments for script (for type: script)',
    validForTypes: ['script']
  },
  command: {
    required: false,
    type: 'string',
    description: 'Inline shell command (for type: command)',
    validForTypes: ['command']
  },
  directory: {
    required: false,
    type: 'string',
    description: 'Working directory for command execution',
    validForTypes: ['command']
  },
  expose: {
    required: false,
    type: 'array',
    description: "List of variable names to extract from stdout and expose as RAILI_VAR_<UPPERCASE>",
    validForTypes: ['script', 'command']
  },
  prompt: {
    required: false,
    type: 'string',
    description: 'Optional prompt for agent',
    validForTypes: ['agent']
  },
  approval: {
    required: false,
    type: 'object',
    description: 'Approval configuration'
  },
  transitions: {
    required: false,
    type: 'record',
    description: 'State transitions keyed by output/result',
    validate: 'mutual-exclusive-with-transitions'
  },
  on: {
    required: false,
    type: 'record',
    description: 'Binary outcomes (PASSED/FAILED) for exit code-based routing',
    validate: 'on-requires-passed',
    recordKeyEnum: ['PASSED', 'FAILED']
  }
};

// WorkflowConfig schema
export const WorkflowConfigSchema: ObjectSchema = {
  initial: {
    required: true,
    type: 'string',
    description: 'ID of the initial state'
  },
  error: {
    required: false,
    type: 'string',
    description: 'Optional ID of the error state to route to on unhandled exceptions'
  },
  states: {
    required: true,
    type: 'record',
    description: 'State definitions keyed by state ID'
  },
  inputs: {
    required: false,
    type: 'array',
    description: 'Declared input names — raili prompts for these on a clean run'
  }
};
