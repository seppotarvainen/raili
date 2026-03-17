import * as readline from 'readline';

export type ManualTransitionConfig = {
  question: string;
  options: Record<string, string>; // e.g., { PASSED: 'execute', FAILED: 'analyze' }
};

export type ManualResult = { chosen: string; target: string; reason: string };

export type ManualOpts = { multiline: boolean | undefined };

/**
 * Prompts the user interactively:
 *
 * Single-line mode (default):
 *   - Press Enter (empty input) → PASSED
 *   - Type anything → FAILED (the text is stored as reason for future use)
 *
 * Multiline mode: collect lines until a line containing only `/q` is entered.
 * The terminating `/q` line is not included in the assembled reason.
 * If the assembled reason is empty, treat as PASSED, otherwise FAILED.
 *
 * For deterministic tests, RAILI_MANUAL_CHOICE env var can be set to a key from options.
 *
 * Backwards-compatible calling:
 *  - handleManualTransition(config)
 *  - handleManualTransition(config, {multiline: true})
 *  - handleManualTransition({multiline: true}) // deprecated but tolerated in tests
 */
export async function handleManualTransition(config: ManualTransitionConfig, opts: ManualOpts): Promise<ManualResult> {
  const keys = Object.keys(config.options || {});
  if (keys.length === 0) throw new Error('No manual options provided');

  // Test escape hatch — skip prompt entirely
  const forced = process.env.RAILI_MANUAL_CHOICE;
  if (forced && keys.includes(forced)) {
    return { chosen: forced, target: config.options[forced], reason: '' };
  }

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  if (opts.multiline) {
    // Inform the user about the terminator and start collecting lines
    console.log(`\n${config.question}\n[Enter multiple lines, finish with a single line containing '/q']`);

    return await new Promise<ManualResult>(resolve => {
      const lines: string[] = [];

      rl.on('line', (line: string) => {

        if (line === '/q') {
          rl.close();
          const reason = lines.join('\n');
          const chosen = reason === '' ? 'PASSED' : 'FAILED';
          resolve({ chosen, target: config.options[chosen], reason });
        } else {
          lines.push(line);
        }
      });
    });
  }

  const answer = await new Promise<string>(resolve => {
    rl.question(`\n${config.question}\n[Enter = PASSED, type reason = FAILED]: `, resolve);
  });

  rl.close();

  const reason = answer.trim();
  const chosen = reason === '' ? 'PASSED' : 'FAILED';

  return { chosen, target: config.options[chosen], reason };
}
