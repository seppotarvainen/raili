jest.mock('child_process', () => ({ spawn: jest.fn() }));

import {
  createTmpWorkspace,
  writeWorkflow,
  writeScriptRegistry,
  writeAgentRegistry,
  writeScriptFile,
  cleanupTmpWorkspace,
  cleanupRailiEnvVars,
} from './testUtils';
import { runCommand } from '../../src/run';
import { spawn } from 'child_process';

describe('integration dry-run', () => {
  let tmp: string;
  beforeEach(() => {
    tmp = createTmpWorkspace();
    (spawn as jest.Mock).mockImplementation(() => ({ stdout: null, stderr: null, on: () => {} }));
  });
  afterEach(() => {
    cleanupTmpWorkspace(tmp);
    cleanupRailiEnvVars();
    (spawn as jest.Mock).mockReset();
  });

  test('dry-run validates registries and workflow references but skips execution and prints summary', async () => {
    writeWorkflow(
      tmp,
      `initial: start\nstates:\n  start:\n    type: script\n    script: check\n    on:\n      PASSED: done\n  done:\n    type: engine\n`,
    );
    writeScriptRegistry(tmp, { check: { path: './scripts/check.sh' } });
    writeAgentRegistry(tmp, {});
    writeScriptFile(tmp, './scripts/check.sh', '#!/bin/sh\necho ok\n');

    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    await runCommand(tmp, 'clean', {}, undefined, true);

    expect((spawn as jest.Mock).mock.calls.length).toBe(0);
    // Ensure no outputs created under .raili/main/outputs (dry-run shouldn't execute scripts)
    const fs = require('fs');
    const outputsDir = require('path').join(tmp, '.raili', 'main', 'outputs');
    const files = fs.readdirSync(outputsDir).filter((f: string) => f !== '.gitkeep');
    expect(files.length).toBe(0);
    expect(logSpy).toHaveBeenCalledWith('Dry-run validation succeeded: no execution performed.');
    logSpy.mockRestore();
  });
});
