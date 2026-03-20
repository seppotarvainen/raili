import { StateMachine } from './types';

type TransitionOutcome = 'PASSED' | 'FAILED' | string;

// Given a state's transition configuration and an outcome key, resolve the target state.
// stateTransitions is an object where keys are outcome names or 'default' mapping to target state string.
// Backwards-compatible behavior: if a transitions map contains exactly one key,
// treat it as the unconditional target to preserve simple workflows that expect a single route.
export function resolveTransition(
  stateTransitions: Record<string, any>,
  outcome: TransitionOutcome,
): string | null {
  if (!stateTransitions) return null;

  // Direct mapping
  if (stateTransitions[outcome]) return stateTransitions[outcome];

  // Case-insensitive matching (e.g. PASSED vs passed)
  const oLower = outcome.toString().toLowerCase();
  for (const [k, v] of Object.entries(stateTransitions)) {
    if (k.toLowerCase() === oLower) return v;
  }

  // default key takes precedence for unknown outcomes
  if (Object.prototype.hasOwnProperty.call(stateTransitions, 'default')) {
    return stateTransitions.default;
  }

  // No matching transition found
  return null;
}
