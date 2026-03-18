import { StateMachine } from './types';

export type TransitionOutcome = 'PASSED' | 'FAILED' | string;

// Given a state's transition configuration and an outcome key, resolve the target state.
// stateTransitions is an object where keys are outcome names or 'default' mapping to target state string.
export function resolveTransition(
  stateTransitions: Record<string, any>,
  outcome: TransitionOutcome,
): string | null {
  if (!stateTransitions) return null;
  // Direct mapping
  if (stateTransitions[outcome]) return stateTransitions[outcome];
  // Fallbacks: 'PASSED' -> 'passed', allow lowercase keys
  const oLower = outcome.toString().toLowerCase();
  for (const [k, v] of Object.entries(stateTransitions)) {
    if (k.toLowerCase() === oLower) return v;
  }
  // default key
  if (stateTransitions.default) return stateTransitions.default;
  return null;
}
