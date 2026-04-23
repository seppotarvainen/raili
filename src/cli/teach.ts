import * as readline from 'readline';
import { appendManualLearning } from '../context/learningStore';
import { learningsFilePath } from '../context/pathUtils';
import { loadAgentRegistry } from '../registry/agentRegistry';

export async function teachCommand(
  cwd: string,
  agentId?: string,
  workflowArg?: string,
  scope: 'global' | 'workflow' = 'global',
) {
  if (!agentId) {
    throw new Error('Usage: raili teach <agentId>');
  }

  // Fail-fast: verify agent exists in the agent registry before prompting
  const registry = loadAgentRegistry(cwd);
  if (!registry[agentId]) {
    throw new Error(`Agent '${agentId}' is not defined in agent-registry.json`);
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
      // Unref stdin so the underlying TTY handle does not prevent the process from exiting
      // (relevant both in production after the CLI finishes and in tests where readline is mocked)
      if (typeof (process.stdin as any).unref === 'function') {
        process.stdin.unref();
      }
      resolve();
    }),
  );

  const content = lines.join('\n').trim();
  if (!content) {
    console.log('No content provided. Aborting.');
    throw new Error('No content provided');
  }

  const appended = appendManualLearning(cwd, agentId, content, workflowArg, scope);
  const path = learningsFilePath(cwd, agentId, workflowArg, scope);
  if (appended) {
    console.log(`Appended manual learning to ${path}`);
  } else {
    console.log('No new learning added (duplicate or empty).');
  }
}
