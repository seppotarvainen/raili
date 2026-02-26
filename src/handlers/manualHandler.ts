import * as readline from 'readline';

export type ManualTransitionConfig = {
  question: string;
  options: Record<string, string>; // e.g., { PASSED: 'execute', FAILED: 'analyze' }
};

export type ManualResult = { chosen: string; target: string; reason: string };

/**
 * Prompts the user interactively:
 *   - Press Enter (empty input) → PASSED
 *   - Type anything → FAILED (the text is stored as reason for future use)
 *
 * For deterministic tests, RAILI_MANUAL_CHOICE env var can be set to a key from options.
 */
export async function handleManualTransition(config: ManualTransitionConfig): Promise<ManualResult> {
  const keys = Object.keys(config.options);
  if (keys.length === 0) throw new Error('No manual options provided');

  // Test escape hatch — skip prompt entirely
  const forced = process.env.RAILI_MANUAL_CHOICE;
  if (forced && keys.includes(forced)) {
    return { chosen: forced, target: config.options[forced], reason: '' };
  }

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  const answer = await new Promise<string>(resolve => {
    rl.question(`\n${config.question}\n[Enter = PASSED, type reason = FAILED]: `, resolve);
  });

  rl.close();

  const reason = answer.trim();
  const chosen = reason === '' ? 'PASSED' : 'FAILED';

  return { chosen, target: config.options[chosen], reason };
}
