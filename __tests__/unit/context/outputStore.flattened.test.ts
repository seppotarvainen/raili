import * as path from 'path';
import { setupFakeFs } from '../infrastructure/fsFake.util';
import { getFileSystem } from '../../../src/infrastructure/fileSystemProvider';
import { saveOutput, readLatestRun } from '../../../src/context/outputStore';

describe('outputStore flattened persistence', () => {
  let cwd: string;
  let outputsDir: string;
  let restoreFs: () => void;

  beforeEach(() => {
    restoreFs = setupFakeFs();
    cwd = '/tmp/test-workspace';
    outputsDir = path.join(cwd, '.raili', 'main', 'outputs');
    getFileSystem().mkdirSync(outputsDir, { recursive: true } as any);
  });

  afterEach(() => {
    restoreFs();
  });

  test('saveOutput writes into parent workflow outputs dir when workflowArg provided', () => {
    saveOutput(cwd, 'sub_state', 'OUTPUT:\nhello world\n', { store: true, marker: 'OUTPUT:' }, 'main');

    const p = path.join(cwd, '.raili', 'main', 'outputs', 'sub_state.md');
    expect(getFileSystem().existsSync(p)).toBe(true);

    const latest = readLatestRun(cwd, 'sub_state', 'main');
    expect(latest).toContain('hello world');
  });
});
