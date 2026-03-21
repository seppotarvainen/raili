import fs from 'fs';
import path from 'path';
import { runCommand } from '../../src/run';
import { loadContext } from '../../src/context';
import {
  createTmpWorkspace,
  cleanupTmpWorkspace,
  writeWorkflow,
  writeAgentRegistry,
  writeScriptRegistry,
  writeAgentFile,
  fakeChild,
  cleanupRailiEnvVars,
} from './testUtils';

jest.mock('child_process', () => ({ spawn: jest.fn() }));
const { spawn } = require('child_process');

let tmpDir: string;

beforeEach(() => {
  tmpDir = createTmpWorkspace();
  spawn.mockImplementation(() => fakeChild('', '', 0));
});

afterEach(() => {
  cleanupTmpWorkspace(tmpDir);
  cleanupRailiEnvVars();
  spawn.mockReset();
});

describe('integration: learning extraction and storage', () => {
  it('extracts LESSON: from producer output and stores it for agent', async () => {
    writeWorkflow(tmpDir, `initial: produce
states:
  produce:
    type: command
    command: |
      echo "Prelude text
      LESSON: This is the lesson
      Details about it"
    output:
      store: true
    on:
      PASSED: analyze
  analyze:
    type: agent
    agent: test_agent
    prompt: "Review"
    learn_from:
      - output: produce
    transitions:
      done: done
  done:
    type: engine
`);

    writeAgentRegistry(tmpDir, { test_agent: { path: './agents/test.agent.md' } });
    writeScriptRegistry(tmpDir, {});
    writeAgentFile(tmpDir, 'agents/test.agent.md', 'Agent instructions');

    spawn.mockImplementation((cmd: string, args?: any[], opts?: any) => {
      if (cmd === 'sh' && Array.isArray(args) && typeof args[1] === 'string') {
        const invoked = args[1] as string;
        if (invoked.includes('echo')) {
          // Return the echoed text as stdout
          return fakeChild('Prelude text\nLESSON: This is the lesson\nDetails about it\n', '', 0);
        }
      }
      if (cmd === 'copilot') return fakeChild('done', '', 0);
      return fakeChild('', '', 0);
    });

    await runCommand(tmpDir, 'clean', {});

    const learningsFile = path.join(tmpDir, '.raili', 'main', 'learnings', 'test_agent.md');
    expect(fs.existsSync(learningsFile)).toBe(true);
    const stored = fs.readFileSync(learningsFile, 'utf8');
    // Should contain only the lesson section, not the Prelude text
    expect(stored).toContain('This is the lesson');
    expect(stored).toContain('Details about it');
    expect(stored).not.toContain('Prelude text');

    const ctx = loadContext(tmpDir);
    expect(ctx.stateHistory[ctx.stateHistory.length - 1].state).toBe('done');
  });
});
