import { StateMachine, StateDef } from './types';
import { createMachine, EventObject } from 'xstate';

// Fixed deterministic state machine skeleton for MVP. This is structural only
// and contains no handlers or business logic. It is validated at startup.

export const FIXED_STATE_MACHINE: StateMachine = {
  initial: 'init',
  states: {
    init: { id: 'init', transitions: ['analyze'] },
    analyze: { id: 'analyze', transitions: ['plan'] },
    plan: { id: 'plan', transitions: ['execute'] },
    execute: { id: 'execute', transitions: ['verify', 'failed'] },
    verify: { id: 'verify', transitions: ['archive', 'execute'] },
    archive: { id: 'archive', transitions: ['done'] },
    done: { id: 'done', transitions: [] },
    failed: { id: 'failed', transitions: [] },
  },
};

// Convert the simple machine shape to an XState machine config
function toXStateConfig(machine: StateMachine) {
  const states: Record<string, any> = {};
  for (const [id, def] of Object.entries(machine.states)) {
    states[id] = {
      on: def.transitions.reduce((acc: Record<string, string>, t: string) => {
        // Use transition name as event, pointing to target state
        acc[t.toUpperCase()] = t;
        return acc;
      }, {}),
    };
  }

  return {
    id: 'fixedStateMachine',
    initial: machine.initial,
    states,
  };
}

export const xstateMachine = createMachine(toXStateConfig(FIXED_STATE_MACHINE));

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

