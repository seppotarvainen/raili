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

describe('integration: feedback resolver', () => {
  beforeEach(() => {
    tmpDir = createTmpWorkspace();
  });

  afterEach(() => {
    cleanupTmpWorkspace(tmpDir);
    cleanupRailiEnvVars();
  });

  it('feedback resolver returns a value that is exposed as var', async () => {
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

    // Create a feedback resolver that returns a fixed string
    writeSubWorkflow(
      tmpDir,
      'main',
      'feedback-resolver.js',
      `module.exports = async function (input) { return 'Automated feedback'; }`,
    );

    await runCommand(tmpDir, 'clean', {});

    const ctxPath = path.join(tmpDir, '.raili', 'main', 'context.json');
    expect(fs.existsSync(ctxPath)).toBe(true);
    const ctx = JSON.parse(fs.readFileSync(ctxPath, 'utf8'));
    expect(ctx.vars).toBeDefined();
    expect(ctx.vars.reviewer_notes).toBe('Automated feedback');
  });
});
