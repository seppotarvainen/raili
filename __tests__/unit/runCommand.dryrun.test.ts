import {
  createTmpWorkspace,
  writeWorkflow,
  writeAgentRegistry,
  writeScriptRegistry,
  writeScriptFile,
  cleanupTmpWorkspace,
} from '../integration/testUtils';
import { runCommand } from '../../src/run';
import { Runner } from '../../src/runner/runner';

describe('runCommand dry-run', () => {
  let tmp: string;
  beforeEach(() => {
    tmp = createTmpWorkspace();
  });
  afterEach(() => {
    cleanupTmpWorkspace(tmp);
  });

  test('performs validations but does not call Runner.run when dryRun=true and prints summary', async () => {
    // Minimal workflow with a script state referencing 'check'
    writeWorkflow(
      tmp,
      `initial: start\nstates:\n  start:\n    type: script\n    script: check\n    on:\n      PASSED: done\n  done:\n    type: engine\n`,
    );

    writeScriptRegistry(tmp, { check: { path: './scripts/check.sh' } });
    writeAgentRegistry(tmp, {});
    writeScriptFile(tmp, './scripts/check.sh', '#!/bin/sh\necho ok\n');

    const spy = jest.spyOn(Runner.prototype, 'run');
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    await runCommand(tmp, 'clean', {}, undefined, true);
    expect(spy).not.toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledWith('Dry-run validation succeeded: no execution performed.');
    spy.mockRestore();
    logSpy.mockRestore();
  });

  test('dry-run reports validation errors for invalid workflow references', async () => {
    writeWorkflow(
      tmp,
      `initial: start\nstates:\n  start:\n    type: script\n    script: missing_script\n    on:\n      PASSED: done\n  done:\n    type: engine\n`,
    );

    // Write empty registries so the workflow reference validation will detect missing script
    writeScriptRegistry(tmp, {});
    writeAgentRegistry(tmp, {});

    await expect(runCommand(tmp, 'clean', {}, undefined, true)).rejects.toThrow(
      /Workflow validation failed/,
    );
  });
});
