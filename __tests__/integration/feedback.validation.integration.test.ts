import { runCommand } from '../../src/run';
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
  spawn.mockImplementation(() => fakeChild('', '', 0));
});

afterEach(() => {
  cleanupTmpWorkspace(tmpDir);
  cleanupRailiEnvVars();
  spawn.mockReset();
});

describe('integration: feedback validation', () => {
  it('fails startup when feedback.expose_var is missing', async () => {
    writeWorkflow(
      tmpDir,
      `initial: s1
states:
  s1:
    type: engine
    feedback: {}
`,
    );

    writeAgentRegistry(tmpDir, {});
    writeScriptRegistry(tmpDir, {});

    await expect(runCommand(tmpDir, 'clean')).rejects.toThrow(/expose_var|feedback/i);
  });

  it('fails startup when feedback.expose_var collides with declared inputs', async () => {
    writeWorkflow(
      tmpDir,
      `initial: s1
inputs: [note]
states:
  s1:
    type: engine
    feedback:
      expose_var: note
`,
    );

    writeAgentRegistry(tmpDir, {});
    writeScriptRegistry(tmpDir, {});

    await expect(runCommand(tmpDir, 'clean')).rejects.toThrow(/conflicts with declared workflow input/i);
  });
});
