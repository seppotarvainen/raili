import fs from 'fs';
import os from 'os';
import path from 'path';
import { loadTriggerModule } from '../../../src/handlers/triggerHandler';

describe('loadTriggerModule', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'raili-trigger-'));
  });

  afterEach(() => {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch (e) {
      // ignore
    }
    // Clear require cache for files inside tmpDir to avoid cross-test pollution
    Object.keys(require.cache).forEach((k) => {
      if (k.startsWith(tmpDir)) delete require.cache[k];
    });
  });

  test('loads async trigger function and returns callable', async () => {
    const triggerFile = path.join(tmpDir, 'trigger.js');
    fs.writeFileSync(triggerFile, "module.exports = async function() { return {a: 'b'}; };\n");

    const fn = await loadTriggerModule(triggerFile);
    expect(typeof fn).toBe('function');
    const res = await fn();
    expect(res).toEqual({ a: 'b' });
  });

  test('throws when file is missing', async () => {
    await expect(loadTriggerModule(path.join(tmpDir, 'nope.js'))).rejects.toThrow(/not found/);
  });

  test('throws when export is not a function', async () => {
    const badFile = path.join(tmpDir, 'bad.js');
    fs.writeFileSync(badFile, 'module.exports = 42;\n');
    await expect(loadTriggerModule(badFile)).rejects.toThrow(/does not export a function/);
  });

  test('throws when function is not async', async () => {
    const syncFile = path.join(tmpDir, 'sync.js');
    fs.writeFileSync(syncFile, "module.exports = function() { return {x:1}; };\n");
    await expect(loadTriggerModule(syncFile)).rejects.toThrow(/must be async/);
  });

  test('handles require error where thrown value has no message property (string throw)', async () => {
    const badFile = path.join(tmpDir, 'throws-string.js');
    // Throwing a plain string (not an Error) so err.message is undefined
    fs.writeFileSync(badFile, 'throw "plain string error";\n');
    await expect(loadTriggerModule(badFile)).rejects.toThrow(/Failed to load trigger module/);
  });
});
