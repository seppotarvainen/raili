import fs from 'fs';
import path from 'path';
// Import runCommand after mocking where necessary
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

describe('run-log integration with approval wait exclusion', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = createTmpWorkspace();
    spawn.mockImplementation(() => fakeChild('', '', 0));
  });

  afterEach(() => {
    cleanupTmpWorkspace(tmpDir);
    cleanupRailiEnvVars();
    spawn.mockReset();
    jest.restoreAllMocks();
  });

  it('records waitMs for approval and run-log duration excludes it', async () => {
    writeWorkflow(
      tmpDir,
      `initial: start
states:
  start:
    type: engine
    on:
      PASSED: review
  review:
    type: engine
    approval:
      question: "Approve?"
      PASSED: done
      FAILED: start
  done:
    type: engine
`,
    );

    writeAgentRegistry(tmpDir, {});
    writeScriptRegistry(tmpDir, {});

    // Spy on manual handler and simulate a 100ms user wait
    const manual = require('../../src/handlers/manualHandler');
    jest.spyOn(manual, 'handleManualTransition').mockImplementation(async (cfg: any) => {
      // simulate user thinking time
      await new Promise((r) => setTimeout(r, 100));
      return { chosen: 'PASSED', target: cfg.options.PASSED, reason: '', waitMs: 100 };
    });

    await runCommand(tmpDir, 'clean', {});

    // Load context and compute raw duration from first to terminal entry
    const ctx = loadContext(tmpDir);
    expect(ctx.stateHistory.length).toBeGreaterThanOrEqual(3);
    const start = new Date(ctx.stateHistory[0].enteredAt).getTime();
    const terminal = new Date(ctx.stateHistory[ctx.stateHistory.length - 1].enteredAt).getTime();
    const rawMs = terminal - start;

    const logPath = path.join(tmpDir, '.raili', 'main', 'run-log.jsonl');
    const contents = fs.readFileSync(logPath, 'utf8').trim();
    const lines = contents.split('\n');
    const last = JSON.parse(lines[lines.length - 1]);

    expect(last.waitMs).toBe(100);
    expect(last.duration).toBe(rawMs - 100);
  });
});
