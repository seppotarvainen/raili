#!/usr/bin/env node
import * as readline from 'readline';
import {initCommand} from './init';
import {runCommand, RunMode} from './run';
import {getCurrentState, loadContext} from './context/context';
import {loadWorkflowConfig} from './workflow/workflowLoader';
import {printHelp} from './cli/help';
import {printDocs} from './cli/docs';
import {printSchema} from './cli/schema';
import commandLineArgs from 'command-line-args';
import {RailiRunArgs} from './types';
import {statsCommand} from './cli/stats';
import {RailiCommand} from './cli/railiCommand';
import {listenCommand} from './cli/listen';
import {teachCommand} from './cli/teach';
import {createCommand} from './cli/create';
import {visualCommand} from './cli/visual';
/** Load .raili/vars.yaml if it exists. Only keys declared in workflow inputs: are used. */
import {loadVarsFile} from './variables/varsLoader';
import {createCancellationController} from './cancellation';

const args = process.argv.slice(2);

// Early handling for --version: print package version and exit 0
if (args.includes('--version') || args[0] === '--version') {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const pkg = require('../package.json');
  process.stdout.write(`${pkg.version}\n`);
  process.exit(0);
}

export function parseRunArgs(argv: string[]): RailiRunArgs {
  // Support bare --next (no value) by converting it to --next=1 before parsing
  const normalizedArgv = argv.slice();
  let hadBareRollback = false;
  for (let i = 0; i < normalizedArgv.length; i++) {
    if (normalizedArgv[i] === '--next') {
      normalizedArgv[i] = '--next=1';
    }
    if (normalizedArgv[i] === '--rollback') {
      // Allow bare --rollback to force continue mode without a value
      hadBareRollback = true;
      normalizedArgv[i] = '--rollback=';
    }
    if (normalizedArgv[i] === '--resolve-vars') {
      // Normalize bare --resolve-vars (no values) to --resolve-vars= so the parser sees it as present
      const next = normalizedArgv[i + 1];
      if (!next || next.startsWith('-')) {
        normalizedArgv[i] = '--resolve-vars=';
      }
    }
  }

  const optionDefinitions = [
    { name: 'workflow', alias: 'w', type: String },
    { name: 'clean', type: Boolean },
    { name: 'continue', type: Boolean },
    { name: 'next', type: Number },
    { name: 'rollback', type: String },
    { name: 'var', type: String, multiple: true, defaultValue: [] },
    { name: 'resolve-vars', type: String, multiple: true },
    { name: 'verbose', alias: 'v', type: Boolean },
    { name: 'help', alias: 'h', type: Boolean },
    { name: 'dry-run', type: Boolean },
  ];
  const parsed = commandLineArgs(optionDefinitions, { argv: normalizedArgv }) as { workflow?: string; clean?: boolean; continue?: boolean; next?: number; rollback?: string; var?: string[]; help?: boolean; 'dry-run'?: boolean; 'resolve-vars'?: string[]; verbose?: boolean };
  const varsArray: string[] = (parsed.var as string[]) || [];
  const vars: Record<string, string> = {};
  for (const entry of varsArray) {
    const [key, ...rest] = entry.split('=');
    if (!key || rest.length === 0) {continue;}
    vars[key.trim()] = rest.join('=').trim();
  }
  // If --next is provided, force continue mode
  const next = typeof parsed.next === 'number' ? parsed.next : undefined;
  if (typeof next !== 'undefined') {
    if (!Number.isInteger(next) || next <= 0) {
      throw new Error('--next must be a positive integer');
    }
  }
  const rollback = typeof parsed.rollback === 'string' && parsed.rollback.length > 0 ? String(parsed.rollback) : undefined;

  // Resolve raw --resolve-vars behavior: if parser produced an array, use it (filter empty strings).
  // If parser did not produce a value but the flag was present (normalizedArgv contains --resolve-vars=), return []
  const rawResolve = parsed['resolve-vars'] as string[] | undefined;
  let resolveVars: string[] | undefined;
  if (Array.isArray(rawResolve)) {
    resolveVars = rawResolve.filter((s) => s !== '');
  } else if (normalizedArgv.some((a) => a.startsWith('--resolve-vars'))) {
    resolveVars = [];
  }

  const mode = next !== undefined ? 'continue' : (rollback !== undefined || hadBareRollback) ? 'continue' : parsed.clean ? 'clean' : parsed.continue ? 'continue' : undefined;
  return { workflow: parsed.workflow, mode, next, rollback, vars, resolveVars, help: !!parsed.help, dryRun: !!parsed['dry-run'], verbose: !!parsed.verbose };
}

function promptLine(rl: readline.Interface, question: string): Promise<string> {
  return new Promise((resolve) => { rl.question(question, resolve); });
}

export { loadVarsFile };

export function parseCreateArgs(argv: string[]): { workflow: string } {
  const optionDefinitions = [
    { name: 'workflow', alias: 'w', type: String },
    { name: 'help', alias: 'h', type: Boolean },
  ];
  const parsed = commandLineArgs(optionDefinitions, { argv }) as { workflow?: string; help?: boolean };
  if (!parsed.workflow || typeof parsed.workflow !== 'string') {
    throw new Error('Missing required -w <workflow> argument');
  }
  return { workflow: parsed.workflow };
}

export function parseVisualArgs(argv: string[]): { workflow?: string; format?: string; out?: string; help?: boolean } {
  const optionDefinitions = [
    { name: 'workflow', alias: 'w', type: String },
    { name: 'format', alias: 'f', type: String },
    { name: 'out', alias: 'o', type: String },
    { name: 'help', alias: 'h', type: Boolean },
  ];
  const parsed = commandLineArgs(optionDefinitions, { argv }) as { workflow?: string; format?: string; out?: string; help?: boolean };
  return { workflow: parsed.workflow, format: parsed.format, out: parsed.out, help: !!parsed.help };
}

/** Prompt the user for any declared inputs that weren't supplied via --var flags */
export async function collectVars(
  cwd: string,
  flagVars: Record<string, string>,
  workflowPath?: string,
): Promise<Record<string, string>> {
  let declaredInputs: { name: string; description: string }[] = [];
  try {
    const config = loadWorkflowConfig(cwd, workflowPath);
    const raw = config.inputs ?? [];
    declaredInputs = raw.map((it: any) => {
      // Allow shorthand string form or object with optional description
      if (typeof it === 'string') {
        return { name: it, description: '' };
      }
      if (typeof it === 'object' && it !== null) {
        if (typeof it.name !== 'string') {throw new Error('inputs entries must have a string name');}
        return {
          name: it.name,
          description: typeof it.description === 'string' ? it.description : '',
        };
      }
      throw new Error('Invalid input declaration: must be a string or object with a name');
    });
  } catch {
    // If workflow can't be loaded here, run() will fail with a proper error
  }

  const declaredNames = declaredInputs.map((d) => d.name);

  // Precedence: flags > vars file > interactive prompt
  const fileVars = loadVarsFile(cwd, declaredNames, workflowPath);
  const merged = { ...fileVars, ...flagVars };

  const missingNames = declaredNames.filter((key) => !(key in merged));
  if (missingNames.length === 0) {return merged;}

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const collected: Record<string, string> = { ...merged };
  for (const name of missingNames) {
    const def = declaredInputs.find((d) => d.name === name);
    if (def?.description) {
      // Print description before prompting (allow multiline)
      console.log(def.description);
    }
    const value = await promptLine(rl, `> ${name}: `);
    collected[name] = value.trim();
  }
  rl.close();
  return collected;
}

export async function promptRunMode(cwd: string, workflowPath?: string): Promise<RunMode> {
  // missing context.json for workflow-scoped runs, malformed JSON, etc.)
  const context = loadContext(cwd, workflowPath);
  const hasExistingContext = getCurrentState(context) !== null;
  if (!hasExistingContext) {return 'clean';}

  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(
      'Existing run detected. Continue from existing run (Enter) or clean run (c)? ',
      (answer) => {
        rl.close();
        resolve(answer.trim().toLowerCase() === 'c' ? 'clean' : 'continue');
      },
    );
  });
}

async function main(command = new RailiCommand(args[0]), runArgs= args.slice(1)) {
  try {
    // Early, deterministic help handling (read-only). Support -h and --help only.
    if (command.isFlagHelp) {
      printHelp();
      process.exit(0);
    }
    // support: raili <command> --help
    try {
      const topParsed = parseRunArgs(runArgs);
      if (command.value && topParsed.help) {
        printHelp(command.value);
        process.exit(0);
      }
    } catch (e) {
      // ignore parse errors for help check; full parsing happens later
    }

    if (command.create) {
      try {
        const parsed = parseCreateArgs(runArgs);
        await createCommand(process.cwd(), parsed.workflow);
        process.exit(0);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg && typeof msg === 'string' && msg.startsWith('EXIT:')) {
          throw err;
        }
        console.error(msg);
        process.exit(1);
      }
    } else if (command.init) {
      await initCommand(process.cwd());
    } else if (command.run) {
      const parsed = parseRunArgs(runArgs);
      const workflowPath = parsed.workflow ? parsed.workflow : undefined;

      let mode: RunMode;
      if (parsed.dryRun) {
        // Non-interactive dry-run should default to clean when mode not provided
        mode = parsed.mode ? parsed.mode : 'clean';
      } else if (parsed.mode) {
        mode = parsed.mode;
      } else {
        mode = await promptRunMode(process.cwd(), workflowPath);
      }

      const flagVars = parsed.vars || {};
      let vars: Record<string, string>;
      if (parsed.dryRun) {
        if (mode === 'clean') {
          const wf = loadWorkflowConfig(process.cwd(), workflowPath);
          const declaredRaw = wf.inputs ?? [];
          const declaredNames: string[] = (declaredRaw as any[])
            .map((it: any) => (typeof it === 'string' ? it : it && typeof it.name === 'string' ? it.name : ''))
            .filter(Boolean);
          const fileVars = loadVarsFile(process.cwd(), declaredNames, workflowPath);
          vars = { ...fileVars, ...flagVars };
        } else {
          vars = flagVars;
        }
      } else {
        vars = mode === 'clean' ? await collectVars(process.cwd(), flagVars, workflowPath) : flagVars;
      }

      const cancellationController = createCancellationController();
      const stdin = process.stdin;
      const originalRawMode =
        typeof stdin.isRaw === 'boolean' ? stdin.isRaw : false;
      const canSetRawMode = typeof stdin.setRawMode === 'function' && stdin.isTTY;
      const onInput = (chunk: Buffer | string): void => {
        const input = typeof chunk === 'string' ? Buffer.from(chunk) : chunk;
        if (input.includes(0x18)) {
          cancellationController.requestCancellation();
        }
        if (input.includes(0x03)) {
          process.kill(process.pid, 'SIGINT');
        }
      };

      let inputListenerInstalled = false;
      try {
        if (canSetRawMode) {
          stdin.setRawMode(true);
        }
        stdin.on('data', onInput);
        // readline used by the run-mode prompt may have paused stdin after its interface closed.
        // Explicitly resume it so Ctrl+X and Ctrl+C reach this listener in every run path.
        stdin.resume();
        inputListenerInstalled = true;
        await runCommand(
          process.cwd(),
          mode,
          vars,
          workflowPath,
          parsed.dryRun,
          parsed.next,
          parsed.rollback,
          parsed.resolveVars,
          parsed.verbose,
          cancellationController,
        );
        if (cancellationController.isCancellationRequested) {
          console.log('Run cancelled gracefully.');
        }
      } finally {
        if (inputListenerInstalled) {
          stdin.removeListener('data', onInput);
        }
        if (canSetRawMode) {
          stdin.setRawMode(originalRawMode);
        }
        stdin.pause();
      }
    } else if (command.help) {
      // raili help [topic]
      const topic = runArgs[0];
      printHelp(undefined, topic);
      process.exit(0);
    } else if (command.docs) {
      // raili docs [section]
      const section = runArgs[0];
      printDocs(section);
      process.exit(0);
    } else if (command.schema) {
      // raili schema
      printSchema();
      process.exit(0);
    } else if (command.stats) {
      // raili stats [<workflow>] [--latest N]
      const workflowArg = runArgs.find((a) => !a.startsWith('-')) || 'main';
      const latestIndex = runArgs.findIndex((a) => a === '--latest');
      const latest =
        latestIndex !== -1 && runArgs[latestIndex + 1] ? Number(runArgs[latestIndex + 1]) : 10;
      try {
        await Promise.resolve(statsCommand(process.cwd(), workflowArg, latest));
        process.exit(0);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(msg);
        process.exit(1);
      }
    } else if (command.visual) {
      try {
        const parsed = parseVisualArgs(runArgs);
        if (parsed.help) {
          printHelp('visual');
          return;
        }
        try {
          await Promise.resolve(
            visualCommand(process.cwd(), parsed.workflow ?? 'main', parsed.format ?? 'mermaid', parsed.out),
          );
          process.exit(0);
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          if (msg && typeof msg === 'string' && msg.startsWith('EXIT:')) {
            throw err;
          }
          console.error(msg);
          process.exit(1);
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(msg);
        process.exit(1);
      }
    } else if (command.listen) {
      try {
        let workflowPath: string | undefined;
        try {
          const parsed = parseRunArgs(runArgs);
          workflowPath = parsed.workflow ? parsed.workflow : undefined;
        } catch {
          workflowPath = undefined;
        }
        if (!workflowPath) {
          const wfIndex = runArgs.findIndex((a) => a === '-w' || a === '--workflow');
          if (wfIndex !== -1 && runArgs[wfIndex + 1]) {workflowPath = runArgs[wfIndex + 1];}
        }
        await listenCommand(process.cwd(), workflowPath);
        process.exit(0);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg && typeof msg === 'string' && msg.startsWith('EXIT:')) {
          throw err;
        }
        console.error(msg);
        process.exit(1);
      }
    } else if (command.teach) {
      try {
        // Tolerant parsing: parseRunArgs can throw on bare positional tokens. Teach accepts a
        // positional <agentId> and optionally -w/--workflow. Try structured parse first, but
        // fall back to manual extraction so positional agent ids are accepted.
        let workflowPath: string | undefined;
        try {
          const parsed = parseRunArgs(runArgs);
          workflowPath = parsed.workflow ? parsed.workflow : undefined;
        } catch {
          // ignore parse errors for teach command
          workflowPath = undefined;
        }
        // If workflow not found via parse, scan for -w/--workflow manually
        if (!workflowPath) {
          const wfIndex = runArgs.findIndex((a) => a === '-w' || a === '--workflow');
          if (wfIndex !== -1 && runArgs[wfIndex + 1]) {workflowPath = runArgs[wfIndex + 1];}
        }
        // Derive agentId as the first non-flag argument (positional)
        const agentId = runArgs.find((a) => !a.startsWith('-'));
        // Parse optional --scope <global|workflow>
        const scopeIndex = runArgs.findIndex((a) => a === '--scope');
        let scope: 'global'|'workflow' = 'global';
        if (scopeIndex !== -1 && runArgs[scopeIndex + 1]) {
          const raw = runArgs[scopeIndex + 1];
          scope = raw === 'workflow' ? 'workflow' : 'global';
        }
        await teachCommand(process.cwd(), agentId, workflowPath, scope);
        process.exit(0);
      } catch (err: unknown) {
        // If the error is an exit sentinel from a mocked process.exit in tests (e.g. 'EXIT:0'),
        // rethrow it so tests can observe the intended exit code instead of being treated as a failure.
        const msg = err instanceof Error ? err.message : String(err);
        if (msg && typeof msg === 'string' && msg.startsWith('EXIT:')) {
          throw err;
        }
        console.error(msg);
        process.exit(1);
      }
    } else if (!command.value) {
      printHelp();
      process.exit(0);
    } else {
      console.error(`Unknown command: ${command.value}\n\nGet help with \'raili help\' or \'raili --help\'.`);
      process.exit(2);
    }
  } catch (err: unknown) {
    // Propagate test sentinel exit errors so test mocks can assert the intended exit code.
    const msg = err instanceof Error ? err.message : String(err);
    if (msg && typeof msg === 'string' && msg.startsWith('EXIT:')) {
      throw err;
    }
    console.error(msg);
    process.exit(1);
  }
}

export { main };

if (require.main === module) {
  main();
}
