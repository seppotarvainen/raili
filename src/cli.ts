#!/usr/bin/env node
import * as readline from 'readline';
import { initCommand } from './init';
import { runCommand, RunMode } from './run';
import { loadContext, getCurrentState } from './context';
import { loadWorkflowConfig } from './workflowLoader';

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

/** Prompt the user for any declared vars that weren't supplied via --var flags */
async function collectVars(cwd: string, flagVars: Record<string, string>): Promise<Record<string, string>> {
  let declared: string[] = [];
  try {
    const config = loadWorkflowConfig(cwd);
    declared = config.vars ?? [];
  } catch {
    // If workflow can't be loaded here, run() will fail with a proper error
  }

  const missing = declared.filter((key) => !(key in flagVars));
  if (missing.length === 0) return flagVars;

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const collected: Record<string, string> = { ...flagVars };
  for (const key of missing) {
    const value = await promptLine(rl, `${key}: `);
    collected[key] = value.trim();
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
      // Only prompt for missing vars on a clean run — continue reuses context.json
      const vars = mode === 'clean'
        ? await collectVars(process.cwd(), flagVars)
        : flagVars;

      await runCommand(process.cwd(), mode, vars);
    } else {
      console.error('Unknown command. Usage: raili init | raili run [--clean | --continue] [--var key=value ...]');
      process.exit(2);
    }
  } catch (err: any) {
    console.error(err.message || String(err));
    process.exit(1);
  }
}

main();
