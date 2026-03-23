#!/usr/bin/env node
import * as readline from 'readline';
import { initCommand } from './init';
import { runCommand, RunMode } from './run';
import { getCurrentState, loadContext } from './context/context';
import { loadWorkflowConfig } from './workflow/workflowLoader';
import { printHelp } from './cli/help';
import { printDocs } from './cli/docs';
import { printSchema } from './cli/schema';
import commandLineArgs from 'command-line-args';
import { RailiRunArgs } from './types';
import { statsCommand } from './cli/stats';
import { RailiCommand } from './cli/RailiCommand';
import { teachCommand } from './cli/teach';
/** Load .raili/vars.yaml if it exists. Only keys declared in workflow inputs: are used. */
import { loadVarsFile } from './variables/varsLoader';

const args = process.argv.slice(2);
const command = new RailiCommand(args[0]);
const runArgs = args.slice(1);

export function parseRunArgs(argv: string[]): RailiRunArgs {
  const optionDefinitions = [
    { name: 'workflow', alias: 'w', type: String },
    { name: 'clean', type: Boolean },
    { name: 'continue', type: Boolean },
    { name: 'var', type: String, multiple: true, defaultValue: [] },
    { name: 'help', alias: 'h', type: Boolean },
  ];
  const parsed: any = commandLineArgs(optionDefinitions, { argv });
  const varsArray: string[] = (parsed.var as string[]) || [];
  const vars: Record<string, string> = {};
  for (const entry of varsArray) {
    const [key, ...rest] = entry.split('=');
    if (!key || rest.length === 0) continue;
    vars[key.trim()] = rest.join('=').trim();
  }
  const mode = parsed.clean ? 'clean' : parsed['continue'] ? 'continue' : undefined;
  return { workflow: parsed.workflow, mode, vars, help: !!parsed.help };
}

function promptLine(rl: readline.Interface, question: string): Promise<string> {
  return new Promise((resolve) => rl.question(question, resolve));
}

export { loadVarsFile };

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
        if (typeof it.name !== 'string') throw new Error('inputs entries must have a string name');
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
  if (missingNames.length === 0) return merged;

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const collected: Record<string, string> = { ...merged };
  for (const name of missingNames) {
    const def = declaredInputs.find((d) => d.name === name);
    if (def && def.description) {
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
  if (!hasExistingContext) return 'clean';

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

async function main() {
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

    if (command.init) {
      await initCommand(process.cwd());
    } else if (command.run) {
      const parsed = parseRunArgs(runArgs);
      const workflowPath = parsed.workflow ? parsed.workflow : undefined;

      let mode: RunMode;
      if (parsed.mode) {
        mode = parsed.mode;
      } else {
        mode = await promptRunMode(process.cwd(), workflowPath);
      }

      const flagVars = parsed.vars || {};
      const vars =
        mode === 'clean' ? await collectVars(process.cwd(), flagVars, workflowPath) : flagVars;

      await runCommand(process.cwd(), mode, vars, workflowPath);
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
      } catch (err: any) {
        console.error(err.message || String(err));
        process.exit(1);
      }
    } else if (command.teach) {
      try {
        const parsed = parseRunArgs(runArgs);
        const workflowPath = parsed.workflow ? parsed.workflow : undefined;
        const agentId = runArgs[0];
        await teachCommand(process.cwd(), agentId, workflowPath);
        process.exit(0);
      } catch (err: any) {
        console.error(err.message || String(err));
        process.exit(1);
      }
    } else if (!command.value) {
      printHelp();
      process.exit(0);
    } else {
      console.error(`Unknown command: ${command.value}\n`);
      printHelp();
      process.exit(2);
    }
  } catch (err: any) {
    console.error(err.message || String(err));
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
