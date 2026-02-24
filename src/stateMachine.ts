// This file is deprecated - state machine is now loaded from workflow.yaml
// Kept for backward compatibility with existing tests
// TODO: Remove after migrating tests to workflowLoader

import { StateMachine } from './types';

// Legacy fixed state machine for backward compatibility
export const FIXED_STATE_MACHINE: StateMachine = {
  initial: 'init',
  states: {
    init: {
      id: 'init',
      config: { type: 'engine' },
      transitions: ['analyze']
    },
    analyze: {
      id: 'analyze',
      config: { type: 'agent', agent: 'analyzer' },
      transitions: ['plan']
    },
    plan: {
      id: 'plan',
      config: { type: 'agent', agent: 'planner' },
      transitions: ['execute']
    },
    execute: {
      id: 'execute',
      config: { type: 'agent', agent: 'executor' },
      transitions: ['test', 'failed']
    },
    test: {
      id: 'test',
      config: { type: 'script', script: 'test' },
      transitions: ['verify', 'failed']
    },
    verify: {
      id: 'verify',
      config: { type: 'agent', agent: 'verifier' },
      transitions: ['archive', 'execute']
    },
    archive: {
      id: 'archive',
      config: { type: 'script', script: 'archive' },
      transitions: ['done']
    },
    done: {
      id: 'done',
      config: { type: 'engine' },
      transitions: []
    },
    failed: {
      id: 'failed',
      config: { type: 'engine' },
      transitions: []
    },
  },
};

// Legacy validation function - use workflowLoader.validateStateMachine instead
export function validateStateMachine(machine: StateMachine): void {
  if (!machine) throw new Error('State machine is undefined');
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
    for (const t of def.transitions) {
      if (!stateKeys.has(t)) {
        throw new Error(`Invalid state machine: state '${id}' has transition to unknown state '${t}'`);
      }
    }
  }
}

