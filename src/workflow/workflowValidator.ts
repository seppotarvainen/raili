import { WorkflowConfig } from '../types';
import { WorkflowConfigSchema } from './schemas';
import { validateObject } from './objectValidator';
import { validateStateConfig, collectFailFastVarRefs } from './stateValidator';
import { SchemaValidationError } from './schemaErrors';

export function validateWorkflowConfig(config: any): WorkflowConfig {
  validateObject(config, WorkflowConfigSchema);

  if (config.initial && config.states) {
    if (!(config.initial in config.states)) {
      throw new SchemaValidationError(`Initial state '${config.initial}' does not exist in states`);
    }
  }

  if (config.error) {
    if (!config.states || !(config.error in config.states)) {
      throw new SchemaValidationError(`Error state '${config.error}' does not exist in states`);
    }
    const errState = config.states[config.error];
    if (errState.on || errState.transitions || errState.approval || errState.continue) {
      throw new SchemaValidationError(
        `Error state '${config.error}' must be terminal and must not have 'on', 'transitions', 'approval', or 'continue'`,
      );
    }
  }

  if (config.states && typeof config.states === 'object') {
    for (const [stateId, stateConfig] of Object.entries(config.states)) {
      try {
        validateStateConfig(stateConfig, stateId);
      } catch (error) {
        if (error instanceof SchemaValidationError) {
          throw new SchemaValidationError(error.message, `state '${stateId}'`);
        }
        throw error;
      }
    }
  }

  if (config.inputs !== undefined) {
    if (!Array.isArray(config.inputs)) {
      throw new SchemaValidationError(`Field 'inputs' must be an array`);
    }
    for (let i = 0; i < config.inputs.length; i++) {
      const item = config.inputs[i];
      if (typeof item === 'string') {
        continue;
      }
      if (typeof item === 'object' && item !== null) {
        if (!('name' in item) || typeof item.name !== 'string') {
          throw new SchemaValidationError(
            `Field 'inputs[${i}]' must have a string 'name' property`,
          );
        }
        if ('description' in item && typeof item.description !== 'string') {
          throw new SchemaValidationError(
            `Field 'inputs[${i}].description' must be a string when provided`,
          );
        }
        if ('log' in item && typeof item.log !== 'boolean') {
          throw new SchemaValidationError(
            `Field 'inputs[${i}].log' must be a boolean when provided`,
          );
        }
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

  const knownVars = new Set<string>();

  if (config.inputs && Array.isArray(config.inputs)) {
    for (const it of config.inputs) {
      const name = typeof it === 'string' ? it : it && typeof it.name === 'string' ? it.name : '';
      if (name) {
        knownVars.add(name);
      }
    }
  }

  if (config.states && typeof config.states === 'object') {
    for (const [stateId, stateConfig] of Object.entries(config.states) as [string, any][]) {
      if (Array.isArray(stateConfig?.expose)) {
        for (const v of stateConfig.expose) {
          if (typeof v === 'string' && v) {
            knownVars.add(v);
          }
        }
      }
      const fbVar = stateConfig?.feedback?.expose_var;
      if (typeof fbVar === 'string' && fbVar) {
        knownVars.add(fbVar);
      }

      // If state declares approval, the runner will expose approval-related variable names
      // immediately (uppercase): <STATEID>_PASSED and <STATEID>_FAILED. Add these to knownVars
      // so fail-fast validation allows teach/other references to them.
      if (stateConfig?.approval) {
        const passedKey = `${stateId}_PASSED`.toUpperCase();
        const failedKey = `${stateId}_FAILED`.toUpperCase();
        knownVars.add(passedKey);
        knownVars.add(failedKey);
      }
    }
  }

  if (config.states && typeof config.states === 'object') {
    for (const [stateId, stateConfig] of Object.entries(config.states)) {
      const refs = collectFailFastVarRefs(stateConfig);
      for (const varName of refs) {
        if (!knownVars.has(varName)) {
          throw new SchemaValidationError(
            `State '${stateId}' references undeclared variable '\${${varName}}'`,
            `state '${stateId}'. Available vars: [${[...knownVars].join(', ')}]`,
          );
        }
      }
    }
  }

  return config as WorkflowConfig;
}
