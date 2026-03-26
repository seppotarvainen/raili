import { runCommand } from '../../src/run';
import { loadContext } from '../../src/context/context';
import {
  cleanupRailiEnvVars,
  cleanupTmpWorkspace,
  createTmpWorkspace,
  fakeChild,
  writeAgentRegistry,
  writeScriptRegistry,
  writeWorkflow,
} from './testUtils';

// Mock child_process globally — engine states (type: engine) produce no spawns,
// but the empty registries still need to be valid and commands/notify use spawn.
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
// 1. Simple linear engine workflow
// ---------------------------------------------------------------------------
describe('simple linear engine workflow', () => {
  it('transitions through two engine states and records history', async () => {
    writeWorkflow(
      tmpDir,
      `
initial: start
states:
  start:
    type: engine
    on:
      PASSED: done
  done:
    type: engine
`,
    );
    writeAgentRegistry(tmpDir, {});
    writeScriptRegistry(tmpDir, {});

    await runCommand(tmpDir, 'clean', {});

    const ctx = loadContext(tmpDir);
    const states = ctx.stateHistory.map((e) => e.state);
    expect(states).toEqual(['start', 'done']);
  });
});

// ---------------------------------------------------------------------------
// 2. Multi-step engine chain
// ---------------------------------------------------------------------------
describe('multi-step engine chain', () => {
  it('traverses three engine states in sequence', async () => {
    writeWorkflow(
      tmpDir,
      `
initial: a
states:
  a:
    type: engine
    on:
      PASSED: b
  b:
    type: engine
    on:
      PASSED: c
  c:
    type: engine
`,
    );
    writeAgentRegistry(tmpDir, {});
    writeScriptRegistry(tmpDir, {});

    await runCommand(tmpDir, 'clean', {});

    const ctx = loadContext(tmpDir);
    const states = ctx.stateHistory.map((e) => e.state);
    expect(states).toEqual(['a', 'b', 'c']);
  });
});

// ---------------------------------------------------------------------------
// 3. Engine state with notify hook
// ---------------------------------------------------------------------------
describe('engine state with notify', () => {
  it('fires notify shell command on state entry', async () => {
    writeWorkflow(
      tmpDir,
      `
initial: start
states:
  start:
    type: engine
    notify: "echo 'starting workflow'"
    on:
      PASSED: done
  done:
    type: engine
    notify: "echo 'workflow done'"
`,
    );
    writeAgentRegistry(tmpDir, {});
    writeScriptRegistry(tmpDir, {});

    await runCommand(tmpDir, 'clean', {});

    // notify runs via spawn('sh', ['-c', command])
    const shCalls = spawn.mock.calls.filter((c: any[]) => c[0] === 'sh');
    const commands = shCalls.map((c: any[]) => c[1][1]);
    expect(commands).toContain("echo 'starting workflow'");
    expect(commands).toContain("echo 'workflow done'");

    const ctx = loadContext(tmpDir);
    expect(ctx.stateHistory[ctx.stateHistory.length - 1].state).toBe('done');
  });
});

// ---------------------------------------------------------------------------
// 4. Engine state with approval (manual handler via RAILI_MANUAL_CHOICE)
// ---------------------------------------------------------------------------
describe('engine state with approval', () => {
  it('routes to PASSED state when approval is accepted', async () => {
    writeWorkflow(
      tmpDir,
      `
initial: review
states:
  review:
    type: engine
    approval:
      question: "Deploy to production?"
      PASSED: deployed
      FAILED: cancelled
  deployed:
    type: engine
  cancelled:
    type: engine
`,
    );
    writeAgentRegistry(tmpDir, {});
    writeScriptRegistry(tmpDir, {});

    // Use the test escape hatch for manual approval
    process.env.RAILI_MANUAL_CHOICE = 'PASSED';

    await runCommand(tmpDir, 'clean', {});

    delete process.env.RAILI_MANUAL_CHOICE;

    const ctx = loadContext(tmpDir);
    const states = ctx.stateHistory.map((e) => e.state);
    expect(states).toEqual(['review', 'deployed']);
  });

  it('routes to FAILED state when approval is rejected', async () => {
    writeWorkflow(
      tmpDir,
      `
initial: review
states:
  review:
    type: engine
    approval:
      question: "Deploy to production?"
      PASSED: deployed
      FAILED: cancelled
  deployed:
    type: engine
  cancelled:
    type: engine
`,
    );
    writeAgentRegistry(tmpDir, {});
    writeScriptRegistry(tmpDir, {});

    process.env.RAILI_MANUAL_CHOICE = 'FAILED';

    await runCommand(tmpDir, 'clean', {});

    delete process.env.RAILI_MANUAL_CHOICE;

    const ctx = loadContext(tmpDir);
    const states = ctx.stateHistory.map((e) => e.state);
    expect(states).toEqual(['review', 'cancelled']);
  });
});
