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

describe('integration: feedback resolver (metadata persistence)', () => {
  beforeEach(() => {
    tmpDir = createTmpWorkspace();
  });

  afterEach(() => {
    cleanupTmpWorkspace(tmpDir);
    cleanupRailiEnvVars();
  });

  it('persists feedback metadata when resolver returns object with metadata', async () => {
    writeWorkflow(
      tmpDir,
      `initial: start
states:
  start:
    type: engine
    feedback:
      expose_var: reviewer_notes
      question: "Notes?"
  done:
    type: engine
`,
    );

    writeAgentRegistry(tmpDir, {});
    writeScriptRegistry(tmpDir, {});

    // Resolver returning object with metadata
    writeSubWorkflow(
      tmpDir,
      'main',
      'feedback-resolver.js',
      `module.exports = async function (input) { return { feedback: 'Auto note', metadata: 'auto-generated' }; }`,
    );

    await runCommand(tmpDir, 'clean', {});

    const ctxPath = path.join(tmpDir, '.raili', 'main', 'context.json');
    expect(fs.existsSync(ctxPath)).toBe(true);
    const ctx = JSON.parse(fs.readFileSync(ctxPath, 'utf8'));

    expect(ctx.vars).toBeDefined();
    expect(ctx.vars.reviewer_notes).toBe('Auto note');

    // feedbacks should include metadata under the state id
    expect(ctx.feedbacks).toBeDefined();
    expect(ctx.feedbacks.start).toBeDefined();
    expect(ctx.feedbacks.start.metadata).toBe('auto-generated');

    // stateHistory meta should include feedback.metadata
    const entry = ctx.stateHistory.find((e: any) => e.state === 'start');
    expect(entry).toBeDefined();
    expect(entry.meta).toBeDefined();
    expect(entry.meta.feedback).toBeDefined();
    expect(entry.meta.feedback.metadata).toBe('auto-generated');
  });
});
