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
  fakeChild,
  cleanupRailiEnvVars,
} from './testUtils';

jest.mock('child_process', () => ({ spawn: jest.fn() }));
const { spawn } = require('child_process');

let tmpDir: string;

beforeEach(() => {
  tmpDir = createTmpWorkspace();
  // Auto-accept the skip-confirmation prompt so tests don't block on stdin
  process.env.RAILI_MANUAL_CHOICE = 'PASSED';
  // default: noop child
  spawn.mockImplementation(() => fakeChild('', '', 0));
});

afterEach(() => {
  cleanupTmpWorkspace(tmpDir);
  cleanupRailiEnvVars();
  spawn.mockReset();
});

describe('integration: skip state end-to-end', () => {
  it('bypasses skipped state, does not run its notify/command, and continues at target', async () => {
    writeWorkflow(tmpDir, `initial: start
states:
  start:
    type: command
    command: echo "SKIPME"
    output:
      store: true
    skip: b
  b:
    type: command
    command: echo "RUNME"
    on:
      PASSED: done
  done:
    type: engine
`);

    // empty registries
    writeAgentRegistry(tmpDir, {});
    writeScriptRegistry(tmpDir, {});

    // Spawn behaviour: only respond to RUNME command explicitly
    spawn.mockImplementation((cmd: string, args?: any[]) => {
      // sh -c "..."
      if (cmd === 'sh' && Array.isArray(args) && args[1] && typeof args[1] === 'string') {
        const invoked = args[1];
        if (invoked.includes('RUNME')) return fakeChild('RUNME\n', '', 0);
        if (invoked.includes('SKIPME')) return fakeChild('SKIPME\n', '', 0);
      }
      return fakeChild('', '', 0);
    });

    await runCommand(tmpDir, 'clean', {});

    const ctx = loadContext(tmpDir);
    expect(ctx.stateHistory[ctx.stateHistory.length - 1].state).toBe('done');

    // Inspect sh calls: ensure RUNME was executed and SKIPME was not
    const shCalls = spawn.mock.calls.filter((c: any[]) => c[0] === 'sh');
    const commands = shCalls.map((c: any[]) => (Array.isArray(c[1]) ? c[1][1] : ''));
    expect(commands.some((s: string) => s.includes('RUNME'))).toBe(true);
    expect(commands.some((s: string) => s.includes('SKIPME'))).toBe(false);

    // Ensure skipped state's output file was not created
    const skippedOutput = path.join(tmpDir, '.raili', 'main', 'outputs', 'start.md');
    expect(fs.existsSync(skippedOutput)).toBe(false);
  });
});
