import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { WorkflowConfig, StateMachine, StateDef } from './types';
import { validateWorkflowConfig } from './schemaValidator';

/**
 * Parse a single YAML file into a raw object, with basic structural checks.
 * Sub-workflow files must NOT define 'initial'.
 */
function loadYamlFile(filePath: string, isSubWorkflow: boolean): any {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Workflow file not found: ${filePath}`);
  }

  const content = fs.readFileSync(filePath, 'utf8');
  const parsed = yaml.load(content) as any;

  if (!parsed || typeof parsed !== 'object') {
    throw new Error(`Workflow file is empty or invalid: ${filePath}`);
  }

  if (isSubWorkflow && parsed.initial) {
    throw new Error(`Sub-workflow file must not define 'initial': ${filePath}`);
  }

  if (!parsed.states || typeof parsed.states !== 'object') {
    throw new Error(`Workflow file must define 'states' object: ${filePath}`);
  }

  return parsed;
}

/**
 * Load and parse workflow.yaml from .raili/ directory.
 * Merges any sub-workflow files listed under 'include:'.
 */
export function loadWorkflowConfig(cwd: string): WorkflowConfig {
  const railiDir = path.join(cwd, '.raili');
  const workflowPath = path.join(railiDir, 'workflow.yaml');

  const main = loadYamlFile(workflowPath, false);

  if (!main.initial || typeof main.initial !== 'string') {
    throw new Error('workflow.yaml must define "initial" state');
  }

  const mergedStates: Record<string, any> = { ...main.states };

  // Load and merge sub-workflow files
  if (main.include) {
    if (!Array.isArray(main.include)) {
      throw new Error('workflow.yaml "include" must be an array of file paths');
    }

    for (const includePath of main.include) {
      if (typeof includePath !== 'string') {
        throw new Error(`Invalid entry in "include": expected a string, got ${typeof includePath}`);
      }

      const fullPath = path.resolve(railiDir, includePath);
      const sub = loadYamlFile(fullPath, true);

      // Fail fast on duplicate state names
      for (const stateId of Object.keys(sub.states)) {
        if (stateId in mergedStates) {
          throw new Error(`Duplicate state '${stateId}' found in sub-workflow: ${fullPath}`);
        }
        mergedStates[stateId] = sub.states[stateId];
      }
    }
  }

  const config = {
    initial: main.initial,
    states: mergedStates,
    inputs: main.inputs,
    include: main.include,
  } as WorkflowConfig;

  // Validate the complete workflow config against schema
  validateWorkflowConfig(config);

  return config;
}

/**
 * Convert workflow config into a runtime state machine with explicit transitions
 */
export function buildStateMachine(config: WorkflowConfig): StateMachine {
  const states: Record<string, StateDef> = {};

  // First pass: create state definitions
  for (const [stateId, stateConfig] of Object.entries(config.states)) {
    const transitions: string[] = [];

    // Collect transitions from 'on' property (PASSED, FAILED, etc.)
    if (stateConfig.on) {
      for (const target of Object.values(stateConfig.on)) {
        if (!transitions.includes(target)) {
          transitions.push(target);
        }
      }
    }

    // Collect transitions from 'transitions' property (conditional routing)
    if (stateConfig.transitions) {
      for (const target of Object.values(stateConfig.transitions)) {
        if (!transitions.includes(target)) {
          transitions.push(target);
        }
      }
    }

    // If state has approval, add those transitions
    if (stateConfig.approval) {
      if (!transitions.includes(stateConfig.approval.PASSED)) {
        transitions.push(stateConfig.approval.PASSED);
      }
      if (!transitions.includes(stateConfig.approval.FAILED)) {
        transitions.push(stateConfig.approval.FAILED);
      }
    }

    states[stateId] = {
      id: stateId,
      config: stateConfig,
      transitions,
    };
  }

  const machine: StateMachine = {
    initial: config.initial,
    states,
  };

  if (config.error) {
    machine.error = config.error;
  }

  return machine;
}

/**
 * Validate state machine structure and transitions
 */
export function validateStateMachine(machine: StateMachine): void {
  if (!machine) {
    throw new Error('State machine is undefined');
  }

  if (typeof machine.initial !== 'string' || !(machine.initial in machine.states)) {
    throw new Error(`Invalid state machine: initial state '${machine.initial}' not defined in states`);
  }

  const stateKeys = new Set(Object.keys(machine.states));

  for (const [id, def] of Object.entries(machine.states)) {
    if (!def || def.id !== id) {
      throw new Error(`Invalid state definition for '${id}': id mismatch`);
    }

    if (!Array.isArray(def.transitions)) {
      throw new Error(`Invalid state definition for '${id}': transitions must be an array`);
    }

    // Validate all transitions point to existing states
    for (const t of def.transitions) {
      if (!stateKeys.has(t)) {
        throw new Error(`Invalid state machine: state '${id}' has transition to unknown state '${t}'`);
      }
    }

    // Validate state config
    const config = def.config;
    if (!config.type || !['agent', 'script', 'command', 'engine'].includes(config.type)) {
      throw new Error(`Invalid state '${id}': type must be 'agent', 'script', 'command', or 'engine'`);
    }

    if (config.on && config.transitions) {
      throw new Error(`Invalid state '${id}': cannot have both 'on' and 'transitions' — use 'on' for binary PASSED/FAILED outcomes, 'transitions' for named outcomes`);
    }

    if (config.type === 'agent' && !config.agent) {
      throw new Error(`Invalid state '${id}': agent type requires 'agent' property`);
    }

    if (config.type === 'script' && !config.script) {
      throw new Error(`Invalid state '${id}': script type requires 'script' property`);
    }

    if (config.type === 'command' && !config.command) {
      throw new Error(`Invalid state '${id}': command type requires 'command' property`);
    }
  }

  // Validate declared error state exists in machine and is terminal
  if (machine.error) {
    if (!(machine.error in machine.states)) {
      throw new Error(`Invalid state machine: declared error state '${machine.error}' not found in states`);
    }
    const errDef = machine.states[machine.error];
    if (errDef.transitions.length > 0) {
      throw new Error(`Invalid state machine: error state '${machine.error}' must be terminal and have no transitions`);
    }
  }
}
