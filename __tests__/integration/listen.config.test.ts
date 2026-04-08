import fs from 'fs';
import path from 'path';
import { listenCommand } from '../../src/cli/listen';
import {
  cleanupRailiEnvVars,
  cleanupTmpWorkspace,
  createTmpWorkspace,
  writeWorkflow,
  writeAgentRegistry,
  writeScriptRegistry,
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

describe('listen command resolver config integration', () => {
  it('loads resolver config when present and logs the load path', async () => {
    // Prepare a minimal workflow so resolver path resolution succeeds
    writeWorkflow(
      tmpDir,
      `
initial: start
states:
  start:
    type: engine
`,
    );

    // Write a resolver config file
    const cfg = { trigger: { interval: 60, timeout: 86400, retry_interval: 10 } };
    const cfgPath = path.join(tmpDir, '.raili', 'main', 'config.json');
    fs.writeFileSync(cfgPath, JSON.stringify(cfg, null, 2), 'utf8');

    // Create an invalid trigger module so loadTriggerModule throws and listenCommand exits early
    const triggerPath = path.join(tmpDir, '.raili', 'main', 'trigger.js');
    fs.writeFileSync(triggerPath, 'module.exports = 123;', 'utf8');

    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    await expect(listenCommand(tmpDir)).rejects.toThrow(/Trigger module/);

    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Loaded resolver config from'));

    logSpy.mockRestore();
  });

  it('does not log config load when resolver config is absent (defaults remain)', async () => {
    writeWorkflow(
      tmpDir,
      `
initial: start
states:
  start:
    type: engine
`,
    );

    // Ensure no config.json exists
    const cfgPath = path.join(tmpDir, '.raili', 'main', 'config.json');
    if (fs.existsSync(cfgPath)) fs.unlinkSync(cfgPath);

    // Invalid trigger to make listenCommand fail fast
    const triggerPath = path.join(tmpDir, '.raili', 'main', 'trigger.js');
    fs.writeFileSync(triggerPath, 'module.exports = 123;', 'utf8');

    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    await expect(listenCommand(tmpDir)).rejects.toThrow(/Trigger module/);

    expect(logSpy).not.toHaveBeenCalledWith(expect.stringContaining('Loaded resolver config from'));

    logSpy.mockRestore();
  });

  it('computeTriggerTimings returns configured ms', () => {
    const cfg = { trigger: { interval: 60, timeout: 86400, retry_interval: 10 } };
    const { computeTriggerTimings } = require('../../src/cli/listen');
    const { pollIntervalMs, failureTimeoutMs, retryIntervalMs } = computeTriggerTimings(cfg);
    expect(pollIntervalMs).toBe(60 * 1000);
    expect(failureTimeoutMs).toBe(86400 * 1000);
    expect(retryIntervalMs).toBe(10 * 1000);
  });
});
