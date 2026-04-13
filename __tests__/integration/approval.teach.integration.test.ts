import * as fs from 'fs';
import * as path from 'path';
import { runCommand } from '../../src/run';
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

describe('integration: approval exposes var names and teach runs after approval', () => {
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

  it('approval reason is appended as learning via teach referencing ${STATE_FAILED}', async () => {
    writeWorkflow(
      tmpDir,
      `initial: check_done
states:
  check_done:
    type: engine
    approval:
      question: "Is this OK?"
      PASSED: done
      FAILED: rework
    teach:
      raili-coding:
        - var: \${CHECK_DONE_FAILED}
    on:
      PASSED: done
      FAILED: rework
  rework:
    type: engine
  done:
    type: engine
`,
    );

    writeAgentRegistry(tmpDir, { 'raili-coding': { path: './agents/raili-coding.md' } });
    writeScriptRegistry(tmpDir, {});
    writeAgentFile(tmpDir, 'agents/raili-coding.md', 'Agent content');

    // Mock manual handler to return FAILED with a lesson-marked reason
    const manual = require('../../src/handlers/manualHandler');
    jest.spyOn(manual, 'handleManualTransition').mockImplementation(async () => {
      return {
        chosen: 'FAILED',
        target: 'rework',
        reason: 'LESSON: Insufficient tests',
        waitMs: 0,
      };
    });

    await runCommand(tmpDir, 'clean', {});

    const learningsFile = path.join(tmpDir, '.raili', 'learnings', 'raili-coding.md');
    expect(fs.existsSync(learningsFile)).toBe(true);
    const stored = fs.readFileSync(learningsFile, 'utf8');
    expect(stored).toContain('Insufficient tests');
  });
});
