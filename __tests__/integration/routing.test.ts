import { runCommand } from '../../src/run';
import { loadContext } from '../../src/context/context';
import {
  cleanupRailiEnvVars,
  cleanupTmpWorkspace,
  createTmpWorkspace,
  fakeChild,
  writeAgentFile,
  writeAgentRegistry,
  writeScriptFile,
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

// Integration tests for the unconditional 'continue' routing
describe('unconditional continue routing', () => {
  it('routes agent state unconditionally to continue target ignoring outcome', async () => {
    writeWorkflow(
      tmpDir,
      `
initial: analyze
states:
  analyze:
    type: agent
    agent: test_agent
    prompt: "Analyze"
    continue: next
  next:
    type: engine
`,
    );

    writeAgentRegistry(tmpDir, { test_agent: { path: './agents/test.agent.md' } });
    writeScriptRegistry(tmpDir, {});
    writeAgentFile(tmpDir, 'agents/test.agent.md', 'Agent');

    spawn.mockImplementation((cmd: string) => {
      if (cmd === 'copilot') return fakeChild('some output\napprove', '', 0);
      return fakeChild('', '', 0);
    });

    await runCommand(tmpDir, 'clean', {});

    const ctx = loadContext(tmpDir);
    expect(ctx.stateHistory[ctx.stateHistory.length - 1].state).toBe('next');
  });

  it('routes script state unconditionally to continue target regardless of exit code', async () => {
    writeWorkflow(
      tmpDir,
      `
initial: check
states:
  check:
    type: script
    script: should_fail
    continue: always_next
  always_next:
    type: engine
`,
    );

    writeAgentRegistry(tmpDir, {});
    writeScriptRegistry(tmpDir, { should_fail: { path: './scripts/fail.sh' } });
    writeScriptFile(tmpDir, 'scripts/fail.sh', '#!/bin/bash\nexit 1');

    spawn.mockImplementation((cmd: string) => {
      if (typeof cmd === 'string' && cmd.includes('fail.sh')) return fakeChild('', 'error', 1);
      return fakeChild('', '', 0);
    });

    await runCommand(tmpDir, 'clean', {});

    const ctx = loadContext(tmpDir);
    expect(ctx.stateHistory[ctx.stateHistory.length - 1].state).toBe('always_next');
  });

  it('detects invalid continue target during build/validation', async () => {
    writeWorkflow(
      tmpDir,
      `
initial: start
states:
  start:
    type: agent
    agent: test_agent
    continue: missing_target
`,
    );

    writeAgentRegistry(tmpDir, { test_agent: { path: './agents/test.agent.md' } });
    writeScriptRegistry(tmpDir, {});
    writeAgentFile(tmpDir, 'agents/test.agent.md', 'Agent');

    // runCommand should throw during validation/build due to unknown continue target
    let threw = false;
    try {
      await runCommand(tmpDir, 'clean', {});
    } catch (e) {
      threw = true;
      expect(String(e)).toContain(
        "Invalid state machine: state 'start' has transition to unknown state 'missing_target'",
      );
    }
    expect(threw).toBe(true);
  });
});
