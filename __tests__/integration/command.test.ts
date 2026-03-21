import fs from 'fs';
import path from 'path';
import {runCommand} from '../../src/run';
import {loadContext} from '../../src/context/context';
import {
    cleanupRailiEnvVars,
    cleanupTmpWorkspace,
    createTmpWorkspace,
    fakeChild,
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

// ---------------------------------------------------------------------------
// 1. Command state with binary on: routing (PASSED)
// ---------------------------------------------------------------------------
describe('command state with on routing — PASSED', () => {
  it('routes to success when command exits 0', async () => {
    writeWorkflow(tmpDir, `
initial: build
states:
  build:
    type: command
    command: "npm run build"
    on:
      PASSED: test
      FAILED: error
  test:
    type: engine
  error:
    type: engine
`);
    writeAgentRegistry(tmpDir, {});
    writeScriptRegistry(tmpDir, {});

    // "npm run build" is spawned via sh -c, mock that to succeed
    spawn.mockImplementation((cmd: string, args: string[]) => {
      if (cmd === 'sh' && args[1] === 'npm run build') {
        return fakeChild('Build succeeded\n', '', 0);
      }
      return fakeChild('', '', 0);
    });

    await runCommand(tmpDir, 'clean', {});

    const ctx = loadContext(tmpDir);
    expect(ctx.stateHistory[ctx.stateHistory.length - 1].state).toBe('test');
  });
});

// ---------------------------------------------------------------------------
// 2. Command state with on: routing (FAILED)
// ---------------------------------------------------------------------------
describe('command state with on routing — FAILED', () => {
  it('routes to error when command exits non-zero', async () => {
    writeWorkflow(tmpDir, `
initial: build
states:
  build:
    type: command
    command: "npm run build"
    on:
      PASSED: test
      FAILED: error
  test:
    type: engine
  error:
    type: engine
`);
    writeAgentRegistry(tmpDir, {});
    writeScriptRegistry(tmpDir, {});

    spawn.mockImplementation((cmd: string, args: string[]) => {
      if (cmd === 'sh' && args[1] === 'npm run build') {
        return fakeChild('', 'Build failed\n', 1);
      }
      return fakeChild('', '', 0);
    });

    await runCommand(tmpDir, 'clean', {});

    const ctx = loadContext(tmpDir);
    expect(ctx.stateHistory[ctx.stateHistory.length - 1].state).toBe('error');
  });
});

// ---------------------------------------------------------------------------
// 3. Command state with transitions routing (last stdout line)
// ---------------------------------------------------------------------------
describe('command state with transitions routing', () => {
  it('routes via last stdout line', async () => {
    writeWorkflow(tmpDir, `
initial: check
states:
  check:
    type: command
    command: "./check_status.sh"
    transitions:
      ok: deploy
      warn: review
  deploy:
    type: engine
  review:
    type: engine
`);
    writeAgentRegistry(tmpDir, {});
    writeScriptRegistry(tmpDir, {});

    spawn.mockImplementation((cmd: string, args: string[]) => {
      if (cmd === 'sh' && args[1] === './check_status.sh') {
        return fakeChild('checking status...\nwarn', '', 0);
      }
      return fakeChild('', '', 0);
    });

    await runCommand(tmpDir, 'clean', {});

    const ctx = loadContext(tmpDir);
    expect(ctx.stateHistory[ctx.stateHistory.length - 1].state).toBe('review');
  });
});

// ---------------------------------------------------------------------------
// 4. Command state with output storage, notify, and approval
// ---------------------------------------------------------------------------
describe('command state with output, notify, and approval', () => {
  it('stores output, fires notify, and routes through approval', async () => {
    writeWorkflow(tmpDir, `
initial: lint
states:
  lint:
    type: command
    command: "npm run lint"
    notify: "echo 'lint starting'"
    output:
      store: true
    approval:
      question: "Lint results look good?"
      PASSED: deploy
      FAILED: fix
  deploy:
    type: engine
  fix:
    type: engine
`);
    writeAgentRegistry(tmpDir, {});
    writeScriptRegistry(tmpDir, {});

    spawn.mockImplementation((cmd: string, args: string[]) => {
      if (cmd === 'sh' && args[1] === 'npm run lint') {
        return fakeChild('lint passed, no issues\n', '', 0);
      }
      return fakeChild('', '', 0);
    });

    // Accept approval
    process.env.RAILI_MANUAL_CHOICE = 'PASSED';

    await runCommand(tmpDir, 'clean', {});

    delete process.env.RAILI_MANUAL_CHOICE;

    // Notify was fired
    const shCalls = spawn.mock.calls.filter((c: any[]) => c[0] === 'sh');
    const commands = shCalls.map((c: any[]) => c[1][1]);
    expect(commands).toContain("echo 'lint starting'");

    // Output was stored
    const outputFile = path.join(tmpDir, '.raili', 'main', 'outputs', 'lint.md');
    expect(fs.existsSync(outputFile)).toBe(true);
    expect(fs.readFileSync(outputFile, 'utf8')).toContain('lint passed');

    // Approval routed to deploy
    const ctx = loadContext(tmpDir);
    const states = ctx.stateHistory.map((e) => e.state);
    expect(states).toEqual(['lint', 'deploy']);
  });
});

