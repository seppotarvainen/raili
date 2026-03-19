import fs from 'fs';
import path from 'path';
import { runCommand } from '../../src/run';
import { createTmpWorkspace, cleanupTmpWorkspace, writeWorkflow, writeScriptRegistry, writeAgentRegistry, writeScriptFile, fakeChild } from './testUtils';

jest.mock('child_process', () => ({ spawn: jest.fn() }));
const { spawn } = require('child_process');

describe('run-log integration', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = createTmpWorkspace();
    spawn.mockReset();
  });

  afterEach(() => {
    cleanupTmpWorkspace(tmpDir);
  });

  it('appends a run-log with loops and approval failures', async () => {
    writeWorkflow(tmpDir, `
initial: start
states:
  start:
    type: script
    script: s1
    on:
      PASSED: review
      FAILED: done
  review:
    type: script
    script: s2
    on:
      PASSED: done
      FAILED: start
  done:
    type: engine
`);
    writeAgentRegistry(tmpDir, {});
    writeScriptRegistry(tmpDir, { s1: { path: 'scripts/s1.sh' }, s2: { path: 'scripts/s2.sh' } });
    writeScriptFile(tmpDir, 'scripts/s1.sh', 'exit 0');
    writeScriptFile(tmpDir, 'scripts/s2.sh', 'exit 1');

    // Sequence: s1 -> PASSED (0), s2 -> FAILED (1) -> start again -> s1 -> PASSED (0), s2 -> PASSED (0)
    spawn.mockImplementationOnce(() => fakeChild('', '', 0));
    spawn.mockImplementationOnce(() => fakeChild('', '', 1));
    spawn.mockImplementationOnce(() => fakeChild('', '', 0));
    spawn.mockImplementationOnce(() => fakeChild('', '', 0));

    await runCommand(tmpDir, 'clean', {});

    const logPath = path.join(tmpDir, '.raili', 'main', 'run-log.jsonl');
    const contents = fs.readFileSync(logPath, 'utf8').trim();
    const lines = contents.split('\n');
    expect(lines.length).toBeGreaterThan(0);
    const last = JSON.parse(lines[lines.length - 1]);
    expect(last.runId).toBeDefined();
    expect(last.states).toBeGreaterThanOrEqual(4);
    expect(last.loops).toBeGreaterThanOrEqual(1);
    expect(last.approvalFailures).toBe(0);
    expect(last.terminalState).toBe('done');
  });
});
