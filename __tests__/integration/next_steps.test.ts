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
  // default: no-op child
  spawn.mockImplementation(() => fakeChild('', '', 0));
});

afterEach(() => {
  cleanupTmpWorkspace(tmpDir);
  cleanupRailiEnvVars();
  spawn.mockReset();
});

describe('--next integration tests', () => {
  it('clean run with --next=2 executes exactly 2 states', async () => {
    writeWorkflow(
      tmpDir,
      `
initial: s1
states:
  s1:
    type: engine
    on:
      PASSED: s2
  s2:
    type: engine
    on:
      PASSED: s3
  s3:
    type: engine
`,
    );

    writeAgentRegistry(tmpDir, {});
    writeScriptRegistry(tmpDir, {});

    await runCommand(tmpDir, 'clean', {}, undefined, false, 2);

    const ctx = loadContext(tmpDir);
    const states = ctx.stateHistory.map((e) => e.state);
    expect(states).toEqual(['s1', 's2']);
  });

  it('bare --next executes 1 state from initial', async () => {
    writeWorkflow(
      tmpDir,
      `
initial: s1
states:
  s1:
    type: engine
    on:
      PASSED: s2
  s2:
    type: engine
    on:
      PASSED: s3
  s3:
    type: engine
`,
    );

    writeAgentRegistry(tmpDir, {});
    writeScriptRegistry(tmpDir, {});

    await runCommand(tmpDir, 'clean', {}, undefined, false, 1);

    const ctx = loadContext(tmpDir);
    const states = ctx.stateHistory.map((e) => e.state);
    expect(states).toEqual(['s1']);
  });

  it('resume behavior: first run 1, then continue with --next=2 adds two more', async () => {
    writeWorkflow(
      tmpDir,
      `
initial: s1
states:
  s1:
    type: engine
    on:
      PASSED: s2
  s2:
    type: engine
    on:
      PASSED: s3
  s3:
    type: engine
`,
    );

    writeAgentRegistry(tmpDir, {});
    writeScriptRegistry(tmpDir, {});

    // First run executes one state
    await runCommand(tmpDir, 'clean', {}, undefined, false, 1);
    let ctx = loadContext(tmpDir);
    expect(ctx.stateHistory.map((e) => e.state)).toEqual(['s1']);

    // Resume with next=2 should execute s2 and s3
    await runCommand(tmpDir, 'continue', {}, undefined, false, 2);
    ctx = loadContext(tmpDir);
    expect(ctx.stateHistory.map((e) => e.state)).toEqual(['s1', 's2', 's3']);
  });

  it('approval state with --next=1 triggers approval but stops after the approval state', async () => {
    writeWorkflow(
      tmpDir,
      `
initial: analyze
states:
  analyze:
    type: agent
    agent: test_agent
    approval:
      question: "Is the analysis good?"
      PASSED: deploy
      FAILED: redo
  deploy:
    type: engine
  redo:
    type: engine
`,
    );

    writeAgentRegistry(tmpDir, { test_agent: { path: './agents/test.agent.md' } });
    writeScriptRegistry(tmpDir, {});
    writeAgentFile(tmpDir, 'agents/test.agent.md', 'Agent instructions');

    spawn.mockImplementation((cmd: string) => {
      if (cmd === 'copilot') return fakeChild('analysis\nready', '', 0);
      return fakeChild('', '', 0);
    });

    // Automatically accept approval prompt
    process.env.RAILI_MANUAL_CHOICE = 'PASSED';

    await runCommand(tmpDir, 'clean', {}, undefined, false, 1);

    const ctx = loadContext(tmpDir);
    const states = ctx.stateHistory.map((e) => e.state);

    // Approval should have been triggered (copilot called)
    const copilotCall = spawn.mock.calls.find((c: any[]) => c[0] === 'copilot');
    expect(copilotCall).toBeDefined();

    // Run should stop after the approval state (only analyze recorded)
    expect(states).toEqual(['analyze']);
  });
});
