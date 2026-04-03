import { runCommand } from '../../src/run';
import { listenCommand } from '../../src/cli/listen';
import {
  cleanupTmpWorkspace,
  createTmpWorkspace,
  writeAgentRegistry,
  writeScriptRegistry,
  writeWorkflow,
  writeScriptFile,
  cleanupRailiEnvVars,
} from './testUtils';

jest.mock('../../src/run');
const mockRunCommand = runCommand as unknown as jest.Mock;

let tmpDir: string;

afterEach(() => {
  cleanupTmpWorkspace(tmpDir);
  cleanupRailiEnvVars();
  jest.clearAllMocks();
  jest.restoreAllMocks();
});

test('listen exits immediately when trigger.js missing', async () => {
  tmpDir = createTmpWorkspace();
  writeWorkflow(tmpDir, `initial: start\nstates:\n  start:\n    type: engine\n`);
  writeAgentRegistry(tmpDir, {});
  writeScriptRegistry(tmpDir, {});

  await expect(listenCommand(tmpDir)).rejects.toThrow(/trigger/i);
});

test('listen polls trigger, executes workflow on event, then resumes polling (calls runCommand)', async () => {
  tmpDir = createTmpWorkspace();
  writeWorkflow(
    tmpDir,
    `initial: process\nstates:\n  process:\n    type: command\n    command: "echo done"\n    on:\n      PASSED: done\n  done:\n    type: engine\n`,
  );
  writeAgentRegistry(tmpDir, {});
  writeScriptRegistry(tmpDir, {});

  // trigger: first call returns an event, second call returns null, third call throws to end the loop
  writeScriptFile(
    tmpDir,
    '.raili/main/trigger.js',
    `let callCount = 0;\nmodule.exports = async function() {\n  callCount++;\n  if (callCount === 1) return { eventId: '123' };\n  if (callCount === 2) return null;\n  throw new Error('done polling');\n};\n`,
  );

  mockRunCommand.mockResolvedValue(undefined);

  // Make setTimeout execute callbacks immediately so loop progresses synchronously
  const originalSetTimeout = global.setTimeout;
  jest.spyOn(global, 'setTimeout').mockImplementation(((cb: any) => {
    cb();
    return 0 as any;
  }) as any);

  // Simulate Date.now progression so that after the thrown error the listener will abort
  jest.spyOn(Date, 'now').mockReturnValueOnce(1000).mockReturnValue(700_000);

  await expect(listenCommand(tmpDir)).rejects.toThrow(/Trigger failing continuously/);

  expect(mockRunCommand).toHaveBeenCalledWith(
    tmpDir,
    'clean',
    { eventId: '123' },
    undefined,
    false,
  );

  // restore
  (global.setTimeout as any) = originalSetTimeout;
});

test('listen exits after 10 minutes of consecutive failures', async () => {
  tmpDir = createTmpWorkspace();
  writeWorkflow(tmpDir, `initial: start\nstates:\n  start:\n    type: engine\n`);
  writeAgentRegistry(tmpDir, {});
  writeScriptRegistry(tmpDir, {});

  writeScriptFile(
    tmpDir,
    '.raili/main/trigger.js',
    `module.exports = async function() { throw new Error('API down'); };\n`,
  );

  // Make setTimeout execute callbacks immediately so loop progresses synchronously
  const originalSetTimeout = global.setTimeout;
  jest.spyOn(global, 'setTimeout').mockImplementation(((cb: any) => {
    cb();
    return 0 as any;
  }) as any);

  // Mock Date.now so timeout condition is met inside listenCommand
  jest.spyOn(Date, 'now').mockReturnValueOnce(1000).mockReturnValue(700_000);

  await expect(listenCommand(tmpDir)).rejects.toThrow(/Trigger failing continuously/);

  (global.setTimeout as any) = originalSetTimeout;
});
