import fs from 'fs';
import path from 'path';
import { runCommand } from '../../src/run';
import { loadContext } from '../../src/context/context';
import {
  cleanupRailiEnvVars,
  cleanupTmpWorkspace,
  createTmpWorkspace,
  fakeChild,
  writeAgentFile,
  writeAgentRegistry,
  writeScriptRegistry,
  writeWorkflow,
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

describe('token persistence', () => {
  it('persists token usage into context.json meta.tokens', async () => {
    writeWorkflow(
      tmpDir,
      `
initial: analyze
states:
  analyze:
    type: agent
    agent: test_agent
    prompt: "Analyze the code"
    transitions:
      approve: complete
  complete:
    type: engine
`,
    );

    writeAgentRegistry(tmpDir, { test_agent: { path: './agents/test.agent.md' } });
    writeScriptRegistry(tmpDir, {});
    writeAgentFile(tmpDir, 'agents/test.agent.md', 'Agent instructions');

    // copilot emits a token line in stdout that should be parsed
    spawn.mockImplementation((cmd: string) => {
      if (cmd === 'copilot')
        return fakeChild('analysis output\n↑ 10 (2 cached) ↓ 5\napprove', '', 0);
      return fakeChild('', '', 0);
    });

    await runCommand(tmpDir, 'clean', {});

    const ctx = loadContext(tmpDir);
    // Find the state that produced tokens (should be 'analyze')
    const producing = ctx.stateHistory.find((e) => e.state === 'analyze');
    expect(producing).toBeDefined();
    const meta: any = producing!.meta ?? {};
    expect(meta.tokens).toBeDefined();
    expect(meta.tokens.input).toBe(10);
    expect(meta.tokens.output).toBe(5);
    expect(meta.tokens.cached).toBe(2);
  });
});
