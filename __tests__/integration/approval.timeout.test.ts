import fs from 'fs';
import path from 'path';
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

jest.mock('child_process', () => ({ spawn: jest.fn() }));

let tmpDir: string;

beforeEach(() => {
  tmpDir = createTmpWorkspace();
});

afterEach(() => {
  cleanupTmpWorkspace(tmpDir);
  cleanupRailiEnvVars();
});

describe('integration: approval timeout via resolver config', () => {
  it('enforces approval timeout from .raili/main/config.json', async () => {
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

    // Create an approval resolver that delays for 2s before returning PASSED
    writeSubWorkflow(
      tmpDir,
      'main',
      'approval-resolver.js',
      `module.exports = async function () { await new Promise(r => setTimeout(r, 2000)); return 'PASSED'; }`,
    );

    // Write resolver config with approval timeout = 1 second
    const cfg = { approval: { timeout: 1 } };
    const cfgPath = path.join(tmpDir, '.raili', 'main', 'config.json');
    fs.writeFileSync(cfgPath, JSON.stringify(cfg, null, 2), 'utf8');

    await expect(runCommand(tmpDir, 'clean', {})).rejects.toThrow(
      /Approval prompt timeout exceeded/,
    );
  });
});
