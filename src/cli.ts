#!/usr/bin/env node
import * as readline from 'readline';
import { initCommand } from './init';
import { runCommand, RunMode } from './run';
import { loadContext, getCurrentState } from './context';

const args = process.argv.slice(2);
const cmd = args[0];
const runArgs = args.slice(1);

function hasFlag(flag: string): boolean {
  return runArgs.includes(flag);
}

async function promptRunMode(cwd: string): Promise<RunMode> {
  // Check if there is an existing context to resume
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
      await runCommand(process.cwd(), mode);
    } else {
      console.error('Unknown command. Usage: raili init | raili run [--clean | --continue]');
      process.exit(2);
    }
  } catch (err: any) {
    console.error(err.message || String(err));
    process.exit(1);
  }
}

main();
