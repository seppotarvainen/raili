import * as readline from 'readline';
import { FeedbackConfig } from '../types';

export type ManualTransitionConfig = {
  question: string;
  options: Record<string, string>; // e.g., { PASSED: 'execute', FAILED: 'analyze' }
  multiline?: boolean;
};

export type ManualResult = { chosen: string; target: string; reason: string };

type ManualOpts = { multiline: boolean | undefined };

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
export async function handleManualTransition(
  config: ManualTransitionConfig,
): Promise<ManualResult> {
  const keys = Object.keys(config.options || {});
  if (keys.length === 0) throw new Error('No manual options provided');

  // Test escape hatch — skip prompt entirely
  const forced = process.env.RAILI_MANUAL_CHOICE;
  if (forced && keys.includes(forced)) {
    return { chosen: forced, target: config.options[forced], reason: '' };
  }

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  if (config.multiline) {
    // Inform the user about the terminator and start collecting lines
    console.log(
      `\n${config.question}\n[Enter multiple lines, finish with a single line containing '/q']`,
    );
    rl.setPrompt('> ');
    rl.prompt();

    return await new Promise<ManualResult>((resolve) => {
      const lines: string[] = [];

      const onLine = (line: string) => {
        if (line === '/q') {
          rl.close();
          const reason = lines.join('\n');
          const chosen = reason === '' ? 'PASSED' : 'FAILED';
          resolve({ chosen, target: config.options[chosen], reason });
        } else {
          lines.push(line);
          rl.prompt();
        }
      };
      rl.on('line', onLine);
    });
  }

  const answer = await new Promise<string>((resolve) => {
    rl.question(`\n${config.question}\n[Enter = PASSED, type reason = FAILED]: `, resolve);
  });

  rl.close();

  const reason = answer.trim();
  const chosen = reason === '' ? 'PASSED' : 'FAILED';

  return { chosen, target: config.options[chosen], reason };
}

/**
 * Collect free-form feedback from the user according to FeedbackConfig.
 * Respects RAILI_FEEDBACK_<UPPERCASE_NAME> env var to bypass stdin (CI).
 * If `required` is true, re-prompts until a non-empty value is provided.
 */
export async function handleFeedbackPrompt(feedback: FeedbackConfig): Promise<string> {
  const name = feedback.expose_var;
  if (!name || name.trim() === '') throw new Error('Feedback: expose_var must be provided');

  const envName = `RAILI_FEEDBACK_${name.toUpperCase()}`;
  const forced = process.env[envName];
  if (typeof forced !== 'undefined') {
    return forced;
  }

  const question = feedback.question ?? `Enter feedback for '${name}':`;
  const multiline = !!feedback.multiline;
  const required = !!feedback.required;

  // Helper to prompt single-line
  const promptSingle = async (): Promise<string> => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const answer = await new Promise<string>((resolve) => {
      rl.question(`\n${question}\n: `, resolve);
    });
    rl.close();
    return answer.trim();
  };

  // Helper to prompt multiline
  const promptMulti = async (): Promise<string> => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    console.log(`\n${question}\n[Enter multiple lines, finish with a single line containing '/q']`);
    rl.setPrompt('> ');
    rl.prompt();

    return await new Promise<string>((resolve) => {
      const lines: string[] = [];
      const onLine = (line: string) => {
        if (line === '/q') {
          rl.close();
          resolve(lines.join('\n'));
        } else {
          lines.push(line);
          rl.prompt();
        }
      };
      rl.on('line', onLine);
    });
  };

  while (true) {
    const val = multiline ? await promptMulti() : await promptSingle();
    if (val !== '' || !required) return val;
    console.log('This feedback is required and cannot be empty. Please provide a value.');
  }
}
