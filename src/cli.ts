#!/usr/bin/env node
import * as readline from 'readline';
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { initCommand } from './init';
import { runCommand, RunMode } from './run';
import { loadContext, getCurrentState } from './context';
import { loadWorkflowConfig } from './workflowLoader';
import colors from "colors/safe";
import { printHelp } from './cli/help';
import { printDocs } from './cli/docs';
import { printSchema } from './cli/schema';

const args = process.argv.slice(2);
const cmd = args[0];
const runArgs = args.slice(1);

function hasFlag(flag: string): boolean {
  return runArgs.includes(flag);
}

/** Parse all --var key=value flags from runArgs */
function parseVarFlags(): Record<string, string> {
  const vars: Record<string, string> = {};
  for (let i = 0; i < runArgs.length; i++) {
    if (runArgs[i] === '--var' && runArgs[i + 1]) {
      const [key, ...rest] = runArgs[i + 1].split('=');
      if (key && rest.length > 0) {
        vars[key.trim()] = rest.join('=').trim();
      }
      i++;
    }
  }
  return vars;
}

function promptLine(rl: readline.Interface, question: string): Promise<string> {
  return new Promise((resolve) => rl.question(question, resolve));
}

/** Load .raili/vars.yaml if it exists. Only keys declared in workflow inputs: are used. */
export function loadVarsFile(cwd: string, declared: string[]): Record<string, string> {
  const varsPath = path.join(cwd, '.raili', 'vars.yaml');
  if (!fs.existsSync(varsPath)) return {};

  const parsed = yaml.load(fs.readFileSync(varsPath, 'utf8')) as any;
  if (!parsed || typeof parsed !== 'object') return {};

  const result: Record<string, string> = {};
  const declaredSet = new Set(declared);

  for (const [key, value] of Object.entries(parsed)) {
    if (declaredSet.has(key)) {
      if (value != null) {
        result[key] = String(value);
      }
    } else {
      console.warn(colors.yellow(`[Warning] Variable '${key}' in vars.yaml is not declared in workflow inputs. It will be ignored.`));
    }
  }
  return result;
}

/** Prompt the user for any declared inputs that weren't supplied via --var flags */
export async function collectVars(cwd: string, flagVars: Record<string, string>): Promise<Record<string, string>> {
  let declaredInputs: {name: string; description: string;}[] = [];
  try {
    const config = loadWorkflowConfig(cwd);
    const raw = config.inputs ?? [];
    declaredInputs = raw.map((it: any) => {
      if (typeof it !== 'object' || it === null || typeof it.name !== 'string' || typeof it.description !== 'string') {
        throw new Error('Workflow inputs must be objects with "name" and "description"');
      }
      return { name: it.name, description: it.description };
    });
  } catch {
    // If workflow can't be loaded here, run() will fail with a proper error
  }

  const declaredNames = declaredInputs.map(d => d.name);

  // Precedence: flags > vars.yaml > interactive prompt
  const fileVars = loadVarsFile(cwd, declaredNames);
  const merged = { ...fileVars, ...flagVars };

  const missingNames = declaredNames.filter((key) => !(key in merged));
  if (missingNames.length === 0) return merged;

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const collected: Record<string, string> = { ...merged };
  for (const name of missingNames) {
    const def = declaredInputs.find(d => d.name === name);
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

async function promptRunMode(cwd: string): Promise<RunMode> {
  let hasExistingContext: boolean;
  try {
    const context = loadContext(cwd);
    hasExistingContext = getCurrentState(context) !== null;
  } catch {
    hasExistingContext = false;
  }

  if (!hasExistingContext) {
    return 'clean';
  }

  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(
      'Existing run detected. Continue from existing run (Enter) or clean run (c)? ',
      (answer) => {
        rl.close();
        resolve(answer.trim().toLowerCase() === 'c' ? 'clean' : 'continue');
      }
    );
  });
}

async function main() {
  try {
    // Early, deterministic help handling (read-only). Support -h and --help only.
    if (cmd === '--help' || cmd === '-h') {
      printHelp();
      process.exit(0);
    }
    if (cmd && (hasFlag('--help') || hasFlag('-h'))) {
      printHelp(cmd);
      process.exit(0);
    }

    if (cmd === 'init') {
      await initCommand(process.cwd());
    } else if (cmd === 'run') {
      let mode: RunMode;
      if (hasFlag('--clean')) {
        mode = 'clean';
      } else if (hasFlag('--continue')) {
        mode = 'continue';
      } else {
        mode = await promptRunMode(process.cwd());
      }

      const flagVars = parseVarFlags();
      const workflowFlagIndex = runArgs.indexOf('--workflow');
      const workflowPath = (workflowFlagIndex !== -1 && runArgs[workflowFlagIndex + 1]) ? runArgs[workflowFlagIndex + 1] : undefined;

      // Only prompt for missing vars on a clean run — continue reuses context.json
      const vars = mode === 'clean'
        ? await collectVars(process.cwd(), flagVars)
        : flagVars;

      await runCommand(process.cwd(), mode, vars, workflowPath);
    } else if (cmd === 'help') {
      // raili help [topic]
      const topic = runArgs[0];
      printHelp(undefined, topic);
      process.exit(0);
    } else if (cmd === 'docs') {
      // raili docs [section]
      const section = runArgs[0];
      printDocs(section);
      process.exit(0);
    } else if (cmd === 'schema') {
      // raili schema
      printSchema();
      process.exit(0);
    } else if (!cmd) {
      printHelp();
      process.exit(0);
    } else {
      console.error(`Unknown command: ${cmd}\n`);
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
