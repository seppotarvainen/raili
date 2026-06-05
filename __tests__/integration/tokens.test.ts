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

    const copilotStdout =
      'analysis output\nAI Credits 0.72 (1h 1m 16s)\nTokens ↑ 10 (2 cached) ↓ 5\napprove';

    spawn.mockImplementation((cmd: string) => {
      if (cmd === 'copilot') return fakeChild(copilotStdout, '', 0);
      return fakeChild('', '', 0);
    });

    await runCommand(tmpDir, 'clean', {});

    const ctx = loadContext(tmpDir);
    // Find the state that produced tokens (should be 'analyze')
    const producing = ctx.stateHistory.find((e) => e.state === 'analyze');
    expect(producing).toBeDefined();
    const meta: any = producing!.meta ?? {};
    expect(meta.tokens).toBeDefined();
    const tokens = meta.tokens;
    expect(tokens.ai_display).toBe('AI Credits 0.72 (1h 1m 16s)');
    expect(tokens.ai_credits).toBeCloseTo(0.72, 5);
    expect(tokens.ai_time).toBe(3676);
    expect(tokens.input).toBe(10);
    expect(tokens.output).toBe(5);
    expect(tokens.cached).toBe(2);
  });
});
