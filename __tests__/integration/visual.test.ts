import * as fs from 'fs';
import * as path from 'path';
import {
  createTmpWorkspace,
  cleanupTmpWorkspace,
  writeWorkflow,
  writeAgentRegistry,
  writeScriptRegistry,
} from './testUtils';
import { RailiCommand } from '../../src/cli/railiCommand';

describe('CLI visual flow', () => {
  const ORIGINAL_CWD = process.cwd();
  let tmp: string;
  let exitMock: jest.SpyInstance;

  beforeEach(() => {
    tmp = createTmpWorkspace();
  });

  afterEach(() => {
    cleanupTmpWorkspace(tmp);
    jest.restoreAllMocks();
    try {
      process.chdir(ORIGINAL_CWD);
    } catch {}
  });

  test('raili visual writes diagram.html to workflow dir', async () => {
    process.chdir(tmp);
    jest.spyOn(process, 'exit').mockImplementation((code?: string | number | null) => {
      return undefined as never;
    });

    // Minimal workflow and empty registries (pass validations)
    writeWorkflow(tmp, `initial: start\nstates:\n  start:\n    type: engine\n`);
    writeAgentRegistry(tmp, {});
    writeScriptRegistry(tmp, {});

    try {
      jest.isolateModules(() => {
        // Import after setting argv/cwd
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const cli = require('../../src/cli');
        return cli.main(new RailiCommand('visual'), []);
      });
    } catch (err: any) {
      if (!String(err.message).startsWith('EXIT:0')) throw err;
    }

    const target = path.join(tmp, '.raili', 'main', 'diagram.html');
    expect(fs.existsSync(target)).toBe(true);
    const content = fs.readFileSync(target, 'utf8');
    expect(content.length).toBeGreaterThan(0);
  });

  test('raili visual fails when registries missing (fail-fast)', async () => {
    process.chdir(tmp);

    // Only workflow present, registries missing
    let exitCode: any;
    writeWorkflow(tmp, `initial: start\nstates:\n  start:\n    type: engine\n`);
    jest.spyOn(process, 'exit').mockImplementation((code?: string | number | null) => {
      exitCode = code;
      return undefined as never;
    });

    // Call should fail silently (exit called with code 1)
    jest.isolateModules(() => {
      const cli = require('../../src/cli');
      cli.main(new RailiCommand('visual'), []);
    });

    // Verify the exit was called with code 1
    expect(exitCode).toBe(1);
  });
});
