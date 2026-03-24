import { ApprovalConfig, StateConfig, StateType, WorkflowConfig } from '../types';
import {
  ApprovalConfigSchema,
  FeedbackConfigSchema,
  FieldSchema,
  ObjectSchema,
  StateConfigSchema,
  WorkflowConfigSchema,
} from './schemas';
import { interpolateObject } from '../variables/variableInterpolation';

export class SchemaValidationError extends Error {
  constructor(
    message: string,
    public context?: string,
  ) {
    const fullMessage = context ? `${message} (in ${context})` : message;
    super(fullMessage);
    this.name = 'SchemaValidationError';
  }
}

/**
 * Validates if a value matches the expected field type
 */
function validateFieldType(value: any, expectedType: string, fieldName: string): void {
  if (value === null || value === undefined) {
    return; // null/undefined checked separately for required fields
  }

  switch (expectedType) {
    case 'string':
      if (typeof value !== 'string') {
        throw new SchemaValidationError(
          `Field '${fieldName}': expected string, got ${typeof value}`,
        );
      }
      break;
    case 'boolean':
      if (typeof value !== 'boolean') {
        throw new SchemaValidationError(
          `Field '${fieldName}': expected boolean, got ${typeof value}`,
        );
      }
      break;
    case 'number':
      if (typeof value !== 'number') {
        throw new SchemaValidationError(
          `Field '${fieldName}': expected number, got ${typeof value}`,
        );
      }
      break;
    case 'array':
      if (!Array.isArray(value)) {
        throw new SchemaValidationError(
          `Field '${fieldName}': expected array, got ${typeof value}`,
        );
      }
      break;
    case 'object':
      if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        throw new SchemaValidationError(
          `Field '${fieldName}': expected object, got ${Array.isArray(value) ? 'array' : typeof value}`,
        );
      }
      break;
    case 'record':
      if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        throw new SchemaValidationError(
          `Field '${fieldName}': expected object, got ${Array.isArray(value) ? 'array' : typeof value}`,
        );
      }
      break;
  }
}

/**
 * Validates a single field against its schema
 */
function validateField(
  fieldName: string,
  fieldValue: any,
  fieldSchema: FieldSchema,
  stateType?: StateType,
  context?: string,
): void {
  // Check if field is required but missing
  if (fieldSchema.required && (fieldValue === null || fieldValue === undefined)) {
    throw new SchemaValidationError(`Required field '${fieldName}' is missing`, context);
  }

  // Skip further validation if field is optional and not provided
  if (fieldValue === null || fieldValue === undefined) {
    return;
  }

  // Check type-dependent validity
  if (fieldSchema.validForTypes && stateType) {
    if (!fieldSchema.validForTypes.includes(stateType as StateType)) {
      throw new SchemaValidationError(
        `Field '${fieldName}' is only valid for type: ${fieldSchema.validForTypes.join(', ')}. ` +
          `This state has type: ${stateType}`,
        context,
      );
    }
  }

  // Check field type
  validateFieldType(fieldValue, fieldSchema.type, fieldName);

  // Check enum constraint
  if (fieldSchema.enum && typeof fieldValue === 'string') {
    if (!fieldSchema.enum.includes(fieldValue)) {
      throw new SchemaValidationError(
        `Field '${fieldName}' must be one of: ${fieldSchema.enum.join(', ')}. Got: ${fieldValue}`,
        context,
      );
    }
  }

  // Check record key enum constraint
  if (fieldSchema.recordKeyEnum && fieldSchema.type === 'record') {
    const invalidKeys = Object.keys(fieldValue).filter(
      (key) => !fieldSchema.recordKeyEnum!.includes(key),
    );
    if (invalidKeys.length > 0) {
      throw new SchemaValidationError(
        `Field '${fieldName}': unknown key '${invalidKeys[0]}'. ` +
          `Allowed keys: ${fieldSchema.recordKeyEnum.join(', ')}`,
        context,
      );
    }
  }
}

/**
 * Validates a generic object against a schema
 */
function validateObject(
  obj: any,
  schema: ObjectSchema,
  context: string = '',
  stateType?: StateType,
): void {
  if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) {
    throw new SchemaValidationError(
      `Expected object, got ${Array.isArray(obj) ? 'array' : typeof obj}`,
      context,
    );
  }

  // Check all defined fields in schema
  for (const [fieldName, fieldSchema] of Object.entries(schema)) {
    const fieldValue = obj[fieldName];
    validateField(fieldName, fieldValue, fieldSchema, stateType, context);
  }

  // Check for unknown fields
  for (const fieldName of Object.keys(obj)) {
    if (!(fieldName in schema)) {
      throw new SchemaValidationError(`Unknown field '${fieldName}'`, context);
    }
  }
}

/**
 * Validates an ApprovalConfig object
 */
export function validateApprovalConfig(config: any): ApprovalConfig {
  validateObject(config, ApprovalConfigSchema, 'approval config');
  return config as ApprovalConfig;
}

/**
 * Validates a StateConfig object
 */
export function validateStateConfig(config: any, stateId: string): StateConfig {
  const context = `state '${stateId}'`;

  validateObject(config, StateConfigSchema, context, config.type);

  // Custom validation: mutual exclusivity of 'on' and 'transitions'
  if (config.on && config.transitions) {
    throw new SchemaValidationError(
      `State cannot have both 'on' and 'transitions' fields`,
      context,
    );
  }

  // Custom validation: 'on' requires 'PASSED' key
  if (config.on && !('PASSED' in config.on)) {
    throw new SchemaValidationError(`Field 'on' requires key 'PASSED' to be defined`, context);
  }

  // Validate nested approval config if present
  if (config.approval) {
    try {
      validateApprovalConfig(config.approval);
    } catch (error) {
      if (error instanceof SchemaValidationError) {
        throw new SchemaValidationError(`Field 'approval': ${error.message}`);
      }
      throw error;
    }
  }

  // Validate feedback config if present
  if (config.feedback) {
    try {
      // Validate feedback shape against the schema
      validateObject(config.feedback, FeedbackConfigSchema as any, `feedback`, config.type);
    } catch (error) {
      if (error instanceof SchemaValidationError) {
        throw new SchemaValidationError(`Field 'feedback': ${error.message}`);
      }
      throw error;
    }
  }

  // Validate max_visits object shape (new structured form)
  if (config.max_visits !== undefined && config.max_visits !== null) {
    const mv = config.max_visits;
    if (typeof mv !== 'object' || Array.isArray(mv)) {
      throw new SchemaValidationError(`Field 'max_visits' expected object`, context);
    }
    if (typeof mv.count !== 'number' || !Number.isFinite(mv.count) || mv.count <= 0) {
      throw new SchemaValidationError(
        `Field 'max_visits.count' must be a positive number`,
        context,
      );
    }
    if ('continue' in mv && mv.continue !== undefined && typeof mv.continue !== 'string') {
      throw new SchemaValidationError(`Field 'max_visits.continue' must be a string`, context);
    }
  }

  // 'expose' must only be used with script or command states
  if (config.expose !== undefined && config.expose !== null) {
    if (!config.type || !['script', 'command'].includes(config.type)) {
      throw new SchemaValidationError(
        `Field 'expose' is only valid for 'script' or 'command' state types`,
      );
    }
    // ensure it's an array (basic check) and elements are strings
    if (!Array.isArray(config.expose) || config.expose.some((v: any) => typeof v !== 'string')) {
      throw new SchemaValidationError(`Field 'expose' must be an array of string variable names`);
    }
  }

  return config as StateConfig;
}

/**
 * Validates a WorkflowConfig object
 */
export function validateWorkflowConfig(config: any): WorkflowConfig {
  validateObject(config, WorkflowConfigSchema);

  // Validate that initial state exists in states
  if (config.initial && config.states) {
    if (!(config.initial in config.states)) {
      throw new SchemaValidationError(`Initial state '${config.initial}' does not exist in states`);
    }
  }

  // If an 'error' state is declared, ensure it exists
  if (config.error) {
    if (!config.states || !(config.error in config.states)) {
      throw new SchemaValidationError(`Error state '${config.error}' does not exist in states`);
    }
    // Ensure the error state is terminal: no on, no transitions, no approval
    const errState = config.states[config.error];
    if (errState.on || errState.transitions || errState.approval) {
      throw new SchemaValidationError(
        `Error state '${config.error}' must be terminal and must not have 'on', 'transitions', or 'approval'`,
      );
    }
  }

  // Validate each state in states
  if (config.states && typeof config.states === 'object') {
    for (const [stateId, stateConfig] of Object.entries(config.states)) {
      try {
        validateStateConfig(stateConfig, stateId);
      } catch (error) {
        if (error instanceof SchemaValidationError) {
          // Re-throw with state context added
          throw new SchemaValidationError(error.message, `state '${stateId}'`);
        }
        throw error;
      }
    }
  }

  // Validate inputs: accept array of strings or objects {name, description?, log?}
  if (config.inputs !== undefined) {
    if (!Array.isArray(config.inputs)) {
      throw new SchemaValidationError(`Field 'inputs' must be an array`);
    }
    for (let i = 0; i < config.inputs.length; i++) {
      const item = config.inputs[i];
      // Accept shorthand string form: e.g. - ticket_id
      if (typeof item === 'string') {
        continue; // valid shorthand
      }
      if (typeof item === 'object' && item !== null) {
        if (!('name' in item) || typeof item.name !== 'string') {
          throw new SchemaValidationError(
            `Field 'inputs[${i}]' must have a string 'name' property`,
          );
        }
        // description is now optional but if present must be a string
        if ('description' in item && typeof item.description !== 'string') {
          throw new SchemaValidationError(
            `Field 'inputs[${i}].description' must be a string when provided`,
          );
        }
        // log is optional but if present must be boolean
        if ('log' in item && typeof item.log !== 'boolean') {
          throw new SchemaValidationError(
            `Field 'inputs[${i}].log' must be a boolean when provided`,
          );
        }
        // no unknown keys allowed
        for (const k of Object.keys(item)) {
          if (!['name', 'description', 'log'].includes(k)) {
            throw new SchemaValidationError(`Field 'inputs[${i}]' contains unknown key '${k}'`);
          }
        }
        continue;
      }
      throw new SchemaValidationError(
        `Field 'inputs[${i}]' must be either a string or an object with 'name' and optional 'description'`,
      );
    }
  }

  // Validate that variables referenced in state-level strings are declared in workflow inputs.
  // Build a set of declared input names.
  const declaredNames = new Set<string>();
  if (config.inputs && Array.isArray(config.inputs)) {
    for (const it of config.inputs) {
      const name = typeof it === 'string' ? it : it && typeof it.name === 'string' ? it.name : '';
      if (name) declaredNames.add(name);
    }
  }

  // Prepare a synthetic vars object containing only declared names so interpolation will fail fast
  // for any referenced variable that is not declared.
  const syntheticVars: Record<string, string> = {};
  for (const n of declaredNames) syntheticVars[n] = 'DUMMY';

  if (config.states && typeof config.states === 'object') {
    for (const [stateId, stateConfig] of Object.entries(config.states)) {
      try {
        // Attempt to interpolate the state config; interpolateObject will throw if any ${VAR}
        // is encountered that is not present in syntheticVars.
        interpolateObject(stateConfig, syntheticVars, { throwOnMissing: true });
      } catch (err: any) {
        const msg = err && err.message ? err.message : String(err);
        throw new SchemaValidationError(
          `State '${stateId}' references undeclared variable: ${msg}`,
          `state '${stateId}'`,
        );
      }
    }
  }

  return config as WorkflowConfig;
}
