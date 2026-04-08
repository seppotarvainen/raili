import * as readline from 'readline';
import {
  FeedbackConfig,
  ApprovalResolverInput,
  FeedbackResolverInput,
  ApprovalResolverResult,
  FeedbackResolverResult,
} from '../types';

export interface ManualTransitionConfig {
  question: string;
  options: Record<string, string>; // e.g., { PASSED: 'execute', FAILED: 'analyze' }
  multiline?: boolean;
}

export interface ManualResult {
  chosen: string;
  target: string;
  reason: string;
  waitMs?: number;
}

// Resolver interfaces (backward-compatible unions)
type ApprovalResolverFunction = (
  input: ApprovalResolverInput,
) =>
  | Promise<ApprovalResolverResult | 'PASSED' | 'FAILED'>
  | ApprovalResolverResult
  | 'PASSED'
  | 'FAILED';

type FeedbackResolverFunction = (
  input: FeedbackResolverInput,
) => Promise<FeedbackResolverResult | string | null> | FeedbackResolverResult | string | null;

/**
 * Normalizers adapt old resolver return shapes (plain strings) to the new object shapes.
 * These helpers are exported so runners/handlers in later parts can call them when a resolver
 * may return either the legacy string or the new structured object.
 */
function isApprovalObj(x: unknown): x is ApprovalResolverResult {
  if (typeof x !== 'object' || x === null) return false;
  const o = (x as { outcome?: unknown }).outcome;
  return o === 'PASSED' || o === 'FAILED';
}

function isFeedbackObj(x: unknown): x is FeedbackResolverResult {
  if (typeof x !== 'object' || x === null) return false;
  const f = (x as { feedback?: unknown }).feedback;
  return typeof f === 'string';
}

export function normalizeApprovalResult(res: unknown): ApprovalResolverResult {
  if (typeof res === 'string') {
    if (res !== 'PASSED' && res !== 'FAILED') {
      throw new Error(`invalid outcome: ${String(res)}`);
    }
    return { outcome: res };
  }

  if (isApprovalObj(res)) {
    // res is now narrowed to ApprovalResolverResult
    const reason = (res as ApprovalResolverResult).reason;
    return { outcome: res.outcome, reason: typeof reason === 'string' ? reason : undefined };
  }

  throw new Error('invalid outcome');
}

export function normalizeFeedbackResult(res: unknown): FeedbackResolverResult | null {
  if (res === null) return null;
  if (typeof res === 'string') {
    if (res.trim() === '') throw new Error('Feedback resolver returned empty feedback');
    return { feedback: res };
  }

  if (isFeedbackObj(res)) {
    const fb = res as FeedbackResolverResult;
    if (typeof fb.feedback !== 'string' || fb.feedback.trim() === '') {
      throw new Error('Feedback resolver returned invalid feedback');
    }
    return {
      feedback: fb.feedback,
      metadata: typeof fb.metadata === 'string' ? fb.metadata : undefined,
    };
  }

  throw new Error('Feedback resolver must return a string or object');
}

/**
 * Loaders for resolver modules. These are fail-fast: throw on invalid modules.
 */
export function loadApprovalResolver(resolverPath: string | null): ApprovalResolverFunction | null {
  if (!resolverPath) return null;
  // Use require to load arbitrary resolver modules (relative or absolute paths supported)
  const mod = require(resolverPath) as unknown;
  const fn =
    typeof mod === 'function'
      ? mod
      : mod && typeof (mod as { default?: unknown }).default === 'function'
        ? (mod as { default?: unknown }).default
        : null;
  if (!fn) {
    throw new Error(`Approval resolver at '${resolverPath}' does not export a function`);
  }
  return fn as ApprovalResolverFunction;
}

export function loadFeedbackResolver(resolverPath: string | null): FeedbackResolverFunction | null {
  if (!resolverPath) return null;
  const mod = require(resolverPath) as unknown;
  const fn =
    typeof mod === 'function'
      ? mod
      : mod && typeof (mod as { default?: unknown }).default === 'function'
        ? (mod as { default?: unknown }).default
        : null;
  if (!fn) {
    throw new Error(`Feedback resolver at '${resolverPath}' does not export a function`);
  }
  return fn as FeedbackResolverFunction;
}

/**
 * Execution wrappers that call resolver functions and propagate exceptions (fail-fast semantics).
 */
export async function executeApprovalResolver(
  resolver: ApprovalResolverFunction,
  input: ApprovalResolverInput,
): Promise<ApprovalResolverResult> {
  try {
    const res = await resolver(input);
    // Normalize legacy string or new object shapes and validate
    const normalized = normalizeApprovalResult(res as unknown);
    // Return full object (outcome + optional reason)
    return normalized;
  } catch (err) {
    throw err;
  }
}

export async function executeFeedbackResolver(
  resolver: FeedbackResolverFunction,
  input: FeedbackResolverInput,
): Promise<FeedbackResolverResult | null> {
  try {
    const res = await resolver(input);
    const normalized = normalizeFeedbackResult(res as unknown);
    return normalized;
  } catch (err) {
    throw err;
  }
}

/**
 * Prompts the user interactively and measures idle wait time spent waiting for user input.
 * Returns the chosen outcome, target state, the reason (if any) and optional waitMs in milliseconds.
 *
 * For deterministic tests, RAILI_MANUAL_CHOICE env var can be set to a key from options (waitMs = 0).
 * If an approvalResolver is provided, it will be executed instead of the CLI prompt.
 */
export async function handleManualTransition(
  config: ManualTransitionConfig,
  approvalResolver?: ApprovalResolverFunction | null,
  resolverInputOverrides?: {
    vars?: Record<string, string>;
    outputPath?: string | null;
    stateName?: string;
  },
  timeoutMs?: number,
): Promise<ManualResult> {
  const keys = Object.keys(config.options || {});
  if (keys.length === 0) {
    throw new Error('No manual options provided');
  }

  const doWork = async (): Promise<ManualResult> => {
    // If resolver provided, execute it and map to ManualResult
    if (approvalResolver) {
      const input: ApprovalResolverInput = {
        question: config.question,
        stateName: resolverInputOverrides?.stateName ?? '',
        vars: resolverInputOverrides?.vars,
        outputPath: resolverInputOverrides?.outputPath ?? null,
      };
      const normalized = await executeApprovalResolver(approvalResolver, input);
      const outcome = normalized.outcome;
      if (!keys.includes(outcome)) {
        throw new Error(`Approval resolver returned unknown outcome '${outcome}'`);
      }
      const reason = typeof normalized.reason === 'string' ? normalized.reason : '';
      return { chosen: outcome, target: config.options[outcome], reason, waitMs: 0 };
    }

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
  };

  if (typeof timeoutMs === 'number' && timeoutMs > 0) {
    let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        doWork(),
        new Promise<ManualResult>((_, reject) => {
          timeoutHandle = setTimeout(
            () => reject(new Error('Approval prompt timeout exceeded')),
            timeoutMs,
          );
        }),
      ]);
    } finally {
      clearTimeout(timeoutHandle);
    }
  }

  return await doWork();
}

/**
 * Collect free-form feedback from the user according to FeedbackConfig.
 * Respects RAILI_FEEDBACK_<UPPERCASE_NAME> env var to bypass stdin (CI).
 * If `required` is true, re-prompts until a non-empty value is provided.
 *
 * If feedbackResolver is provided it will be executed instead of CLI prompt.
 */
export async function handleFeedbackPrompt(
  feedback: FeedbackConfig,
  feedbackResolver?: FeedbackResolverFunction | null,
  timeoutMs?: number,
): Promise<FeedbackResolverResult | string | null> {
  const name = feedback.expose_var;
  if (!name || name.trim() === '') {
    throw new Error('Feedback: expose_var must be provided');
  }

  const doWork = async (): Promise<FeedbackResolverResult | string | null> => {
    // If resolver provided, execute it and return either the legacy string (when resolver returned a string),
    // or the structured object when resolver returned an object. Keep null as-is.
    if (feedbackResolver) {
      const input: FeedbackResolverInput = {
        prompt: feedback.question ?? `Enter feedback for '${name}':`,
        stateName: '',
        config: feedback,
      };
      // Call resolver directly so we can preserve legacy string shape when appropriate.
      const raw = await feedbackResolver(input as FeedbackResolverInput);
      // Validate/normalize to ensure the resolver returned an allowed shape; reuse existing normalizer for validation.
      const normalized = normalizeFeedbackResult(raw as unknown);
      if (raw === null) return null;
      if (typeof raw === 'string') return raw;
      // raw is an object - return the normalized object form
      return normalized;
    }

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
      console.log(
        `\n${question}\n[Enter multiple lines, finish with a single line containing '/q']`,
      );
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
      if (val !== '' || !required) {
        return val;
      }
      console.log('This feedback is required and cannot be empty. Please provide a value.');
    }
  };

  if (typeof timeoutMs === 'number' && timeoutMs > 0) {
    let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        doWork(),
        new Promise<FeedbackResolverResult | string | null>((_, reject) => {
          timeoutHandle = setTimeout(
            () => reject(new Error('Feedback prompt timeout exceeded')),
            timeoutMs,
          );
        }),
      ]);
    } finally {
      clearTimeout(timeoutHandle);
    }
  }

  return await doWork();
}
