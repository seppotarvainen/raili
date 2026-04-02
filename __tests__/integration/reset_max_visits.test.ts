import fs from 'fs';
import path from 'path';
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

jest.mock('child_process', () => ({ spawn: jest.fn() }));
const { spawn } = require('child_process');

let tmpDir: string;

beforeEach(() => {
  tmpDir = createTmpWorkspace();
  // default noop child
  spawn.mockImplementation(() => fakeChild('', '', 0));
});

afterEach(() => {
  cleanupTmpWorkspace(tmpDir);
  cleanupRailiEnvVars();
  spawn.mockReset();
});

describe('integration: reset_max_visits nested loops', () => {
  it('allows inner loop to reset max_visits on each outer iteration and completes', async () => {
    writeWorkflow(
      tmpDir,
      `initial: outer
states:
  outer:
    type: command
    command: echo "outer"
    reset_max_visits:
      - inner
    on:
      PASSED: inner
      FAILED: end

  inner:
    type: command
    command: echo "inner"
    max_visits:
      count: 2
    on:
      PASSED: inner
      FAILED: outer

  end:
    type: engine
`,
    );

    writeAgentRegistry(tmpDir, {});
    writeScriptRegistry(tmpDir, {});

    let outerCount = 0;
    let innerRunsSinceOuter = 0;

    spawn.mockImplementation((cmd: string, args: any[]) => {
      if (cmd === 'sh' && Array.isArray(args) && typeof args[1] === 'string') {
        const invoked = args[1];
        if (invoked === 'echo "outer"') {
          outerCount++;
          // Reset inner run counter when outer is invoked
          innerRunsSinceOuter = 0;
          // Allow two outer iterations, then make outer fail to route to end
          if (outerCount <= 2) return fakeChild('outer\n', '', 0);
          return fakeChild('', '', 1);
        }
        if (invoked === 'echo "inner"') {
          innerRunsSinceOuter++;
          // Simulate inner being entered twice per outer iteration: first time PASSED (loops), second time FAILED (returns to outer)
          if (innerRunsSinceOuter === 1) return fakeChild('inner\n', '', 0);
          return fakeChild('', '', 1);
        }
      }
      return fakeChild('', '', 0);
    });

    await runCommand(tmpDir, 'clean', {});

    const ctx = loadContext(tmpDir);
    // Final state should be 'end'
    expect(ctx.stateHistory[ctx.stateHistory.length - 1].state).toBe('end');

    // Count occurrences of outer and inner in history
    const states = ctx.stateHistory.map((e) => e.state);
    const outerOccurrences = states.filter((s) => s === 'outer').length;
    const innerOccurrences = states.filter((s) => s === 'inner').length;

    // Expect at least two outer iterations and at least 2 inner entries (at least one inner loop per outer)
    expect(outerOccurrences).toBeGreaterThanOrEqual(2);
    expect(innerOccurrences).toBeGreaterThanOrEqual(2);
  });
});
