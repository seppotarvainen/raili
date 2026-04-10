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
  writeNamedWorkflow,
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

describe('workflow variable in agent prompts', () => {
  it('injects workflow var into agent prompt for default workflow', async () => {
    writeWorkflow(
      tmpDir,
      `
initial: analyze
states:
  analyze:
    type: agent
    agent: test_agent
    prompt: "Analyze workflow \${workflow}"
    transitions:
      done: complete
  complete:
    type: engine
`,
    );

    writeAgentRegistry(tmpDir, { test_agent: { path: './agents/test.agent.md' } });
    writeScriptRegistry(tmpDir, {});
    writeAgentFile(tmpDir, 'agents/test.agent.md', 'Agent instructions');

    spawn.mockImplementation((cmd: string) => {
      if (cmd === 'copilot') return fakeChild('done', '', 0);
      return fakeChild('', '', 0);
    });

    await runCommand(tmpDir, 'clean', {});

    const ctx = loadContext(tmpDir);
    expect(ctx.vars!.workflow).toBe('main');

    const copilotCall = spawn.mock.calls.find((c: any[]) => c[0] === 'copilot');
    expect(copilotCall).toBeDefined();
    const args = copilotCall![1] as string[];
    const promptIdx = args.indexOf('--prompt');
    expect(args[promptIdx + 1]).toContain('main');
  });

  it('injects workflow var into agent prompt for named workflow', async () => {
    writeNamedWorkflow(
      tmpDir,
      'dev',
      `
initial: analyze
states:
  analyze:
    type: agent
    agent: test_agent
    prompt: "Analyze workflow \${workflow}"
    transitions:
      done: complete
  complete:
    type: engine
`,
    );

    writeAgentRegistry(tmpDir, { test_agent: { path: './agents/test.agent.md' } });
    writeScriptRegistry(tmpDir, {});
    writeAgentFile(tmpDir, 'agents/test.agent.md', 'Agent instructions');

    spawn.mockImplementation((cmd: string) => {
      if (cmd === 'copilot') return fakeChild('done', '', 0);
      return fakeChild('', '', 0);
    });

    await runCommand(tmpDir, 'clean', {}, 'dev');

    const ctx = loadContext(tmpDir, 'dev');
    expect(ctx.vars!.workflow).toBe('dev');

    const copilotCall = spawn.mock.calls.find((c: any[]) => c[0] === 'copilot');
    expect(copilotCall).toBeDefined();
    const args = copilotCall![1] as string[];
    const promptIdx = args.indexOf('--prompt');
    expect(args[promptIdx + 1]).toContain('dev');
  });

  it('preserves workflow var on continue runs', async () => {
    writeWorkflow(
      tmpDir,
      `
initial: analyze
states:
  analyze:
    type: agent
    agent: test_agent
    prompt: "Analyze workflow \${workflow}"
    transitions:
      done: complete
  complete:
    type: engine
`,
    );

    writeAgentRegistry(tmpDir, { test_agent: { path: './agents/test.agent.md' } });
    writeScriptRegistry(tmpDir, {});
    writeAgentFile(tmpDir, 'agents/test.agent.md', 'Agent instructions');

    spawn.mockImplementation((cmd: string) => {
      if (cmd === 'copilot') return fakeChild('done', '', 0);
      return fakeChild('', '', 0);
    });

    // initial clean run
    await runCommand(tmpDir, 'clean', {});
    let ctx = loadContext(tmpDir);
    expect(ctx.vars!.workflow).toBe('main');

    // continue run should preserve existing workflow var
    spawn.mockImplementation((cmd: string) => {
      if (cmd === 'copilot') return fakeChild('done', '', 0);
      return fakeChild('', '', 0);
    });

    await runCommand(tmpDir, 'continue', {});
    ctx = loadContext(tmpDir);
    expect(ctx.vars!.workflow).toBe('main');
  });
});
