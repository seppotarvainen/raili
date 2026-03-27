import * as readline from 'readline';
import { appendManualLearning } from '../context/learningStore';
import { learningsFilePath } from '../context/pathUtils';

export async function teachCommand(cwd: string, agentId?: string, workflowArg?: string) {
  if (!agentId) {
    throw new Error('Usage: raili teach <agentId>');
  }

  console.log(`Write a lesson to the agent '${agentId}'. (Close with /q)`);

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const lines: string[] = [];

  rl.on('line', (line: string) => {
    if (line.trim() === '/q') {
      rl.close();
    } else {
      lines.push(line);
    }
  });

  await new Promise<void>((resolve) =>
    rl.on('close', () => {
      resolve();
    }),
  );

  const content = lines.join('\n').trim();
  if (!content) {
    console.log('No content provided. Aborting.');
    throw new Error('No content provided');
  }

  const appended = appendManualLearning(cwd, agentId, content, workflowArg);
  const path = learningsFilePath(cwd, agentId, workflowArg);
  if (appended) {
    console.log(`Appended manual learning to ${path}`);
  } else {
    console.log('No new learning added (duplicate or empty).');
  }
}
