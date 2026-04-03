import * as fs from 'fs';
import * as path from 'path';
import { runCommand } from '../../src/run';
import {
  cleanupRailiEnvVars,
  cleanupTmpWorkspace,
  createTmpWorkspace,
  writeAgentRegistry,
  writeScriptRegistry,
  writeWorkflow,
  writeSubWorkflow,
} from './testUtils';

let tmpDir: string;

describe('integration: approval resolver (failure cases)', () => {
  beforeEach(() => {
    tmpDir = createTmpWorkspace();
  });

  afterEach(() => {
    cleanupTmpWorkspace(tmpDir);
    cleanupRailiEnvVars();
  });

  it('routes to FAILED target when resolver returns FAILED', async () => {
    writeWorkflow(
      tmpDir,
      `initial: start
states:
  start:
    type: engine
    approval:
      question: "Approve?"
      PASSED: done
      FAILED: rework
  rework:
    type: engine
  done:
    type: engine
`,
    );

    writeAgentRegistry(tmpDir, {});
    writeScriptRegistry(tmpDir, {});

    // Create an approval resolver that always returns FAILED
    writeSubWorkflow(
      tmpDir,
      'main',
      'approval-resolver.js',
      `module.exports = async function (input) { return 'FAILED'; }`,
    );

    await runCommand(tmpDir, 'clean', {});

    const ctxPath = path.join(tmpDir, '.raili', 'main', 'context.json');
    expect(fs.existsSync(ctxPath)).toBe(true);
    const ctx = JSON.parse(fs.readFileSync(ctxPath, 'utf8'));
    const states = ctx.stateHistory.map((e: any) => e.state);
    // final state should be 'rework'
    expect(states[states.length - 1]).toBe('rework');
  });

  it('stops the run when resolver throws (fail-fast)', async () => {
    writeWorkflow(
      tmpDir,
      `initial: start
states:
  start:
    type: engine
    approval:
      question: "Approve?"
      PASSED: done
      FAILED: rework
  rework:
    type: engine
  done:
    type: engine
`,
    );

    writeAgentRegistry(tmpDir, {});
    writeScriptRegistry(tmpDir, {});

    // Create an approval resolver that throws
    writeSubWorkflow(
      tmpDir,
      'main',
      'approval-resolver.js',
      `module.exports = async function (input) { throw new Error('External API down'); }`,
    );

    await expect(runCommand(tmpDir, 'clean', {})).rejects.toThrow('External API down');
  });
});
