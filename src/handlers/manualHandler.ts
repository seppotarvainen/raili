export type ManualTransitionConfig = {
  question: string;
  options: Record<string, string>; // e.g., { PASSED: 'execute', FAILED: 'analyze' }
};

export type ManualResult = { chosen: string; target: string };

// For deterministic tests, RAILI_MANUAL_CHOICE env var can be set to a key from options.
export function handleManualTransition(config: ManualTransitionConfig): ManualResult {
  const keys = Object.keys(config.options);
  if (keys.length === 0) throw new Error('No manual options provided');
  const forced = process.env.RAILI_MANUAL_CHOICE;
  const choice = forced && keys.includes(forced) ? forced : keys[0];
  return { chosen: choice, target: config.options[choice] };
}
