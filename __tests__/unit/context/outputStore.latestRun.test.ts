import * as path from 'path';
import { setupFakeFs } from '../infrastructure/fsFake.util';
import { getFileSystem } from '../../../src/infrastructure/fileSystemProvider';
import {readLatestRun} from '../../../src/context/outputStore';

describe('readLatestRun', () => {
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

  test('returns null when no file exists', () => {
    const res = readLatestRun(cwd, 'nonexistent');
    expect(res).toBeNull();
  });

  test('reads last run content when multiple runs present', () => {
    const p = path.join(outputsDir, 'teststate.md');
    const content = `first run\n--- Run 2026-03-01T00:00:00Z ---\nold\n\n--- Run 2026-03-02T00:00:00Z ---\nnewest content\n`;
    getFileSystem().writeFileSync(p, content, 'utf8');
    const res = readLatestRun(cwd, 'teststate');
    expect(res).toContain('newest content');
  });
});
