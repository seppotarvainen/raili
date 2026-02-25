import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { WorkflowConfig, StateMachine, StateDef } from './types';

/**
 * Load and parse workflow.yaml from .raili/ directory
 */
export function loadWorkflowConfig(cwd: string): WorkflowConfig {
  const workflowPath = path.join(cwd, '.raili', 'workflow.yaml');

  if (!fs.existsSync(workflowPath)) {
    throw new Error('workflow.yaml not found in .raili/ directory');
  }

  const content = fs.readFileSync(workflowPath, 'utf8');
  const parsed = yaml.load(content) as any;

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('workflow.yaml is empty or invalid');
  }

  if (!parsed.initial || typeof parsed.initial !== 'string') {
    throw new Error('workflow.yaml must define "initial" state');
  }

  if (!parsed.states || typeof parsed.states !== 'object') {
    throw new Error('workflow.yaml must define "states" object');
  }

  return parsed as WorkflowConfig;
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

  return {
    initial: config.initial,
    states,
  };
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
}

