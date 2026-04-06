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

describe('integration: approval resolver (reason persistence)', () => {
  beforeEach(() => {
    tmpDir = createTmpWorkspace();
  });

  afterEach(() => {
    cleanupTmpWorkspace(tmpDir);
    cleanupRailiEnvVars();
  });

  it('persists reason when resolver returns object with reason', async () => {
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

    // Resolver returning object with reason
    writeSubWorkflow(
      tmpDir,
      'main',
      'approval-resolver.js',
      `module.exports = async function (input) { return { outcome: 'FAILED', reason: 'Missing tests' }; }`,
    );

    await runCommand(tmpDir, 'clean', {});

    const ctxPath = path.join(tmpDir, '.raili', 'main', 'context.json');
    expect(fs.existsSync(ctxPath)).toBe(true);
    const ctx = JSON.parse(fs.readFileSync(ctxPath, 'utf8'));

    // approvals and vars should contain the reason under START_FAILED
    expect(ctx.approvals).toBeDefined();
    expect(ctx.approvals.START_FAILED).toBe('Missing tests');
    expect(ctx.vars).toBeDefined();
    expect(ctx.vars.START_FAILED).toBe('Missing tests');

    // stateHistory entry for start should include meta.approval.reason
    const entry = ctx.stateHistory.find((e: any) => e.state === 'start');
    expect(entry).toBeDefined();
    expect(entry.meta).toBeDefined();
    expect(entry.meta.approval).toBeDefined();
    expect(entry.meta.approval.reason).toBe('Missing tests');
  });
});
