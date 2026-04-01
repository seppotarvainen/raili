import { StateConfig } from '../types';
import { FeedbackConfigSchema, StateConfigSchema } from './schemas';
import { validateObject } from './objectValidator';
import { validateApprovalConfig } from './approvalValidator';
import { SchemaValidationError } from './schemaErrors';

export function validateStateConfig(config: any, stateId: string): StateConfig {
  const context = `state '${stateId}'`;

  validateObject(config, StateConfigSchema, context, config.type);

  // 'continue' is an unconditional routing target and must be mutually exclusive with other routing fields
  if (config.continue !== undefined && config.continue !== null) {
    if (typeof config.continue !== 'string' || config.continue === '') {
      throw new SchemaValidationError(`Field 'continue' must be a non-empty string`, context);
    }
    if (config.on) {
      throw new SchemaValidationError(`State cannot have both 'continue' and 'on' fields`, context);
    }
    if (config.transitions) {
      throw new SchemaValidationError(
        `State cannot have both 'continue' and 'transitions' fields`,
        context,
      );
    }
    if (config.approval) {
      throw new SchemaValidationError(
        `State cannot have both 'continue' and 'approval' fields`,
        context,
      );
    }
  }

  if (config.on && config.transitions) {
    throw new SchemaValidationError(
      `State cannot have both 'on' and 'transitions' fields`,
      context,
    );
  }

  if (config.on && !('PASSED' in config.on)) {
    throw new SchemaValidationError(`Field 'on' requires key 'PASSED' to be defined`, context);
  }

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

  if (config.feedback) {
    try {
      validateObject(config.feedback, FeedbackConfigSchema as any, `feedback`, config.type);
    } catch (error) {
      if (error instanceof SchemaValidationError) {
        throw new SchemaValidationError(`Field 'feedback': ${error.message}`);
      }
      throw error;
    }
  }

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

  if (config.expose !== undefined && config.expose !== null) {
    if (!config.type || !['script', 'command'].includes(config.type)) {
      throw new SchemaValidationError(
        `Field 'expose' is only valid for 'script' or 'command' state types`,
      );
    }
    if (!Array.isArray(config.expose) || config.expose.some((v: any) => typeof v !== 'string')) {
      throw new SchemaValidationError(`Field 'expose' must be an array of string variable names`);
    }
  }

  return config as StateConfig;
}

function collectVarRefs(obj: any, refs: Set<string>): void {
  if (typeof obj === 'string') {
    const re = /\$\{([A-Za-z_][A-Za-z0-9_]*)\}/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(obj)) !== null) {
      refs.add(m[1]);
    }
    return;
  }
  if (Array.isArray(obj)) {
    for (const item of obj) {
      collectVarRefs(item, refs);
    }
    return;
  }
  if (obj !== null && typeof obj === 'object') {
    for (const value of Object.values(obj)) {
      collectVarRefs(value, refs);
    }
  }
}

export function collectFailFastVarRefs(stateConfig: any): Set<string> {
  const refs = new Set<string>();
  const { prompt: _p, approval, feedback, ...rest } = stateConfig as any;

  collectVarRefs(rest, refs);

  if (approval && typeof approval === 'object') {
    const { question: _q, ...restApproval } = approval;
    collectVarRefs(restApproval, refs);
  }
  if (feedback && typeof feedback === 'object') {
    const { question: _q, ...restFeedback } = feedback;
    collectVarRefs(restFeedback, refs);
  }

  return refs;
}
