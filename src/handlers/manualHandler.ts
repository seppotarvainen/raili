import * as readline from 'readline';
import { FeedbackConfig } from '../types';

export type ManualTransitionConfig = {
  question: string;
  options: Record<string, string>; // e.g., { PASSED: 'execute', FAILED: 'analyze' }
  multiline?: boolean;
};

export type ManualResult = { chosen: string; target: string; reason: string; waitMs?: number };

type ManualOpts = { multiline: boolean | undefined };

/**
 * Prompts the user interactively and measures idle wait time spent waiting for user input.
 * Returns the chosen outcome, target state, the reason (if any) and optional waitMs in milliseconds.
 *
 * For deterministic tests, RAILI_MANUAL_CHOICE env var can be set to a key from options (waitMs = 0).
 */
export async function handleManualTransition(
  config: ManualTransitionConfig,
): Promise<ManualResult> {
  const keys = Object.keys(config.options || {});
  if (keys.length === 0) throw new Error('No manual options provided');

  // Test escape hatch — skip prompt entirely
  const forced = process.env.RAILI_MANUAL_CHOICE;
  if (forced && keys.includes(forced)) {
    return { chosen: forced, target: config.options[forced], reason: '', waitMs: 0 };
  }

  // Create readline interface when ready to prompt. Measure wait starting immediately before attaching listeners.
  if (config.multiline) {
    console.log(
      `\n${config.question}\n[Enter multiple lines, finish with a single line containing '/q']`,
    );
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.setPrompt('> ');
    rl.prompt();

    const waitStart = Date.now();

    return await new Promise<ManualResult>((resolve) => {
      const lines: string[] = [];

      const onLine = (line: string) => {
        if (line === '/q') {
          rl.close();
          const reason = lines.join('\n');
          const chosen = reason === '' ? 'PASSED' : 'FAILED';
          const waitMs = Date.now() - waitStart;
          resolve({ chosen, target: config.options[chosen], reason, waitMs });
        } else {
          lines.push(line);
          rl.prompt();
        }
      };
      rl.on('line', onLine);
    });
  }

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const waitStart = Date.now();

  const answer = await new Promise<string>((resolve) => {
    rl.question(`\n${config.question}\n[Enter = PASSED, type reason = FAILED]: `, resolve);
  });

  rl.close();

  const reason = answer.trim();
  const chosen = reason === '' ? 'PASSED' : 'FAILED';
  const waitMs = Date.now() - waitStart;

  return { chosen, target: config.options[chosen], reason, waitMs };
}

/**
 * Collect free-form feedback from the user according to FeedbackConfig.
 * Respects RAILI_FEEDBACK_<UPPERCASE_NAME> env var to bypass stdin (CI).
 * If `required` is true, re-prompts until a non-empty value is provided.
 *
 * NOTE: This function preserves its existing API and returns the feedback text only. The caller (Engine)
 * is responsible for measuring and persisting wait durations for feedback prompts if desired.
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
