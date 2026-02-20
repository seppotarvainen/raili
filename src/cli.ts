#!/usr/bin/env node
import { initCommand } from './init';
import { runCommand } from './run';

const args = process.argv.slice(2);
const cmd = args[0];

async function main() {
  try {
    if (cmd === 'init') {
      await initCommand(process.cwd());
    } else if (cmd === 'run') {
      await runCommand(process.cwd());
    } else {
      console.error('Usage: raili <init|run>');
      process.exit(2);
    }
  } catch (err: any) {
    console.error(err.message || String(err));
    process.exit(1);
  }
}

main();

