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

// ---------------------------------------------------------------------------
// 1. Script state with binary on: routing (PASSED)
// ---------------------------------------------------------------------------
describe('script state with binary on routing — PASSED', () => {
  it('routes to success state when script exits 0', async () => {
    writeWorkflow(tmpDir, `
initial: run_tests
states:
  run_tests:
    type: script
    script: test_runner
    on:
      PASSED: success
      FAILED: failed
  success:
    type: engine
  failed:
    type: engine
`);
    writeAgentRegistry(tmpDir, {});
    writeScriptRegistry(tmpDir, { test_runner: { path: './scripts/run_tests.sh' } });
    writeScriptFile(tmpDir, 'scripts/run_tests.sh', '#!/bin/bash\necho "tests passed"');

    spawn.mockImplementation((cmd: string) => {
      if (cmd.includes('run_tests.sh')) return fakeChild('tests passed\n', '', 0);
      return fakeChild('', '', 0);
    });

    await runCommand(tmpDir, 'clean', {});

    const scriptCall = spawn.mock.calls.find((c: any[]) =>
      typeof c[0] === 'string' && c[0].includes('run_tests.sh'),
    );
    expect(scriptCall).toBeDefined();

    const ctx = loadContext(tmpDir);
    expect(ctx.stateHistory[ctx.stateHistory.length - 1].state).toBe('success');
  });
});

// ---------------------------------------------------------------------------
// 2. Script state with binary on: routing (FAILED)
// ---------------------------------------------------------------------------
describe('script state with binary on routing — FAILED', () => {
  it('routes to failed state when script exits non-zero', async () => {
    writeWorkflow(tmpDir, `
initial: run_tests
states:
  run_tests:
    type: script
    script: test_runner
    on:
      PASSED: success
      FAILED: failed
  success:
    type: engine
  failed:
    type: engine
`);
    writeAgentRegistry(tmpDir, {});
    writeScriptRegistry(tmpDir, { test_runner: { path: './scripts/run_tests.sh' } });
    writeScriptFile(tmpDir, 'scripts/run_tests.sh', '#!/bin/bash\nexit 1');

    spawn.mockImplementation((cmd: string) => {
      if (cmd.includes('run_tests.sh')) return fakeChild('', 'test failure output', 1);
      return fakeChild('', '', 0);
    });

    await runCommand(tmpDir, 'clean', {});

    const ctx = loadContext(tmpDir);
    expect(ctx.stateHistory[ctx.stateHistory.length - 1].state).toBe('failed');
  });
});

// ---------------------------------------------------------------------------
// 3. Script state with transitions routing (last stdout line)
// ---------------------------------------------------------------------------
describe('script state with transitions routing', () => {
  it('routes via last stdout line as transition key', async () => {
    writeWorkflow(tmpDir, `
initial: check
states:
  check:
    type: script
    script: checker
    transitions:
      clean: deploy
      dirty: fix
  deploy:
    type: engine
  fix:
    type: engine
`);
    writeAgentRegistry(tmpDir, {});
    writeScriptRegistry(tmpDir, { checker: { path: './scripts/check.sh' } });
    writeScriptFile(tmpDir, 'scripts/check.sh', '#!/bin/bash\necho "clean"');

    spawn.mockImplementation((cmd: string) => {
      if (cmd.includes('check.sh')) return fakeChild('checking...\nclean', '', 0);
      return fakeChild('', '', 0);
    });

    await runCommand(tmpDir, 'clean', {});

    const ctx = loadContext(tmpDir);
    expect(ctx.stateHistory[ctx.stateHistory.length - 1].state).toBe('deploy');
  });
});

// ---------------------------------------------------------------------------
// 4. Script state with output storage and notify
// ---------------------------------------------------------------------------
describe('script state with output storage and notify', () => {
  it('stores output and fires notify on entry', async () => {
    writeWorkflow(tmpDir, `
initial: build
states:
  build:
    type: script
    script: builder
    notify: "echo 'build starting'"
    output:
      store: true
      tail: 50
    on:
      PASSED: done
      FAILED: error
  done:
    type: engine
  error:
    type: engine
`);
    writeAgentRegistry(tmpDir, {});
    writeScriptRegistry(tmpDir, { builder: { path: './scripts/build.sh' } });
    writeScriptFile(tmpDir, 'scripts/build.sh', '#!/bin/bash\necho "build output"');

    spawn.mockImplementation((cmd: string) => {
      if (cmd.includes('build.sh')) return fakeChild('build output line 1\nbuild output line 2\n', '', 0);
      return fakeChild('', '', 0);
    });

    await runCommand(tmpDir, 'clean', {});

    // Notify was fired
    const shCalls = spawn.mock.calls.filter((c: any[]) => c[0] === 'sh');
    const commands = shCalls.map((c: any[]) => c[1][1]);
    expect(commands).toContain("echo 'build starting'");

    // Output was stored
    const outputFile = path.join(tmpDir, '.raili', 'main', 'outputs', 'build.md');
    expect(fs.existsSync(outputFile)).toBe(true);
    const content = fs.readFileSync(outputFile, 'utf8');
    expect(content).toContain('build output line 1');

    const ctx = loadContext(tmpDir);
    expect(ctx.stateHistory[ctx.stateHistory.length - 1].state).toBe('done');
  });
});

