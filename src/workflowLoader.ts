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
import { resolveWorkflowDir } from './pathUtils';

export function loadWorkflowConfig(cwd: string, workflowPath?: string): WorkflowConfig {
  const railiDir = path.join(cwd, '.raili');

  // Determine workflow directory first (may be .raili/main or .raili/<name> or a custom path)
  const workflowDir = resolveWorkflowDir(cwd, workflowPath);
  const resolvedPath = path.join(workflowDir, 'workflow.yaml');

  const main = loadYamlFile(resolvedPath, false);

  if (!main.initial || typeof main.initial !== 'string') {
    throw new Error('workflow.yaml must define "initial" state');
  }

  // Validate the raw parsed workflow object against schema so unknown top-level
  // fields cause a fail-fast validation error.
  validateWorkflowConfig(main);

  // Normalize inputs to [{name, description?}] form for downstream code (description optional)
  let normalizedInputs: any[] | undefined = undefined;
  if (main.inputs !== undefined) {
    if (!Array.isArray(main.inputs)) {
      throw new Error('Field "inputs" must be an array');
    }
    normalizedInputs = main.inputs.map((it: any, idx: number) => {
      // allow shorthand string form
      if (typeof it === 'string') {
        return { name: it, description: undefined, log: false };
      }
      if (typeof it === 'object' && it !== null) {
        if (typeof it.name !== 'string') throw new Error(`inputs[${idx}].name must be a string`);
        if ('description' in it && typeof it.description !== 'string')
          throw new Error(`inputs[${idx}].description must be a string when provided`);
        if ('log' in it && typeof it.log !== 'boolean')
          throw new Error(`inputs[${idx}].log must be a boolean when provided`);
        return {
          name: it.name,
          description: typeof it.description === 'string' ? it.description : undefined,
          log: typeof it.log === 'boolean' ? it.log : false,
        };
      }
      throw new Error(
        `Invalid input declaration at index ${idx}: inputs must be strings or objects with 'name'`,
      );
    });
  }

  const config: WorkflowConfig = {
    initial: main.initial,
    states: main.states,
    inputs: normalizedInputs,
  };

  if (main.error) {
    config.error = main.error;
  }

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
    throw new Error(
      `Invalid state machine: initial state '${machine.initial}' not defined in states`,
    );
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
        throw new Error(
          `Invalid state machine: state '${id}' has transition to unknown state '${t}'`,
        );
      }
    }

    // Validate state config
    const config = def.config;
    if (!config.type || !['agent', 'script', 'command', 'engine'].includes(config.type)) {
      throw new Error(
        `Invalid state '${id}': type must be 'agent', 'script', 'command', or 'engine'`,
      );
    }

    if (config.on && config.transitions) {
      throw new Error(
        `Invalid state '${id}': cannot have both 'on' and 'transitions' — use 'on' for binary PASSED/FAILED outcomes, 'transitions' for named outcomes`,
      );
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

    // Basic validation for learn_from entries shape (must be objects with 'output' or 'var')
    if (config.learn_from) {
      if (!Array.isArray(config.learn_from)) {
        throw new Error(`Invalid state '${id}': learn_from must be an array`);
      }
      for (const entry of config.learn_from) {
        if (typeof entry !== 'object' || entry === null) {
          throw new Error(`Invalid state '${id}': learn_from entries must be objects`);
        }
        const keys = Object.keys(entry);
        if (keys.length !== 1 || !['output', 'var'].includes(keys[0])) {
          throw new Error(
            `Invalid state '${id}': learn_from entries must be of form {output: <stateId>} or {var: "${'{VAR}'}"}`,
          );
        }
      }
    }
  }

  // Cross-state validation: ensure learn_from output references exist and have output.store=true
  for (const [id, def] of Object.entries(machine.states)) {
    const cfg = def.config;
    if (!cfg.learn_from) continue;
    for (const entry of cfg.learn_from) {
      if ((entry as any).output) {
        const ref = (entry as any).output as string;
        if (!stateKeys.has(ref)) {
          throw new Error(
            `Invalid state '${id}': learn_from references unknown state '${ref}' via output:${ref}`,
          );
        }
        const refCfg = machine.states[ref].config;
        if (!refCfg.output || !refCfg.output.store) {
          throw new Error(
            `Invalid state '${id}': learn_from output reference '${ref}' must have output.store: true`,
          );
        }
      }
      if ((entry as any).var) {
        const raw = (entry as any).var as string;
        const varPattern = /^\$\{([A-Za-z_][A-Za-z0-9_]*)\}$/;
        if (!varPattern.test(raw)) {
          throw new Error(
            `Invalid state '${id}': learn_from var entry '${raw}' must be in the form ${'${VAR_NAME}'} `,
          );
        }
      }
    }
  }

  // Validate declared error state exists in machine and is terminal
  if (machine.error) {
    if (!(machine.error in machine.states)) {
      throw new Error(
        `Invalid state machine: declared error state '${machine.error}' not found in states`,
      );
    }
    const errDef = machine.states[machine.error];
    if (errDef.transitions.length > 0) {
      throw new Error(
        `Invalid state machine: error state '${machine.error}' must be terminal and have no transitions`,
      );
    }
  }
}
