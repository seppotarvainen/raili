import * as path from 'path';
import { setupFakeFs } from '../infrastructure/fsFake.util';
import { getFileSystem } from '../../../src/infrastructure/fileSystemProvider';
import { readLatestNRuns } from '../../../src/context/outputStore';

describe('readLatestNRuns', () => {
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
    const res = readLatestNRuns(cwd, 'nonexistent', 3);
    expect(res).toBeNull();
  });

  test('returns all runs when n is undefined', () => {
    const p = path.join(outputsDir, 'teststate.md');
    const content = `first run\n\n--- Run 2026-03-01T00:00:00Z ---\n\nold\n\n--- Run 2026-03-02T00:00:00Z ---\n\nnewest content\n`;
    getFileSystem().writeFileSync(p, content, 'utf8');
    const res = readLatestNRuns(cwd, 'teststate', undefined);
    expect(res).toContain('first run');
    expect(res).toContain('old');
    expect(res).toContain('newest content');
    expect((res as string).split('--- Run').length).toBeGreaterThanOrEqual(2);
  });

  test('returns all runs when n is null', () => {
    const p = path.join(outputsDir, 'teststate.md');
    const content = `head\n\n--- Run A ---\n\nA1\n\n--- Run B ---\n\nB1\n`;
    getFileSystem().writeFileSync(p, content, 'utf8');
    const res = readLatestNRuns(cwd, 'teststate', null);
    expect(res).toContain('head');
    expect(res).toContain('A1');
    expect(res).toContain('B1');
  });

  test('returns latest N runs', () => {
    const p = path.join(outputsDir, 'teststate.md');
    const content = `run1\n\n--- Run 1 ---\n\nrun2\n\n--- Run 2 ---\n\nrun3\n\n--- Run 3 ---\n\nrun4\n`;
    getFileSystem().writeFileSync(p, content, 'utf8');

    const res = readLatestNRuns(cwd, 'teststate', 2);
    expect(res).toContain('run3');
    expect(res).toContain('run4');
    expect(res).not.toContain('run1');
    expect(res).not.toContain('run2');
    // Ensure correct order: run3 appears before run4
    expect(res!.indexOf('run3')).toBeLessThan(res!.indexOf('run4'));
    // Separators preserved
    expect(res).toContain('--- Run 3 ---');
  });

  test('n greater than available returns all available runs', () => {
    const p = path.join(outputsDir, 'teststate.md');
    const content = `one\n\n--- Run X ---\n\ntwo\n`;
    getFileSystem().writeFileSync(p, content, 'utf8');
    const res = readLatestNRuns(cwd, 'teststate', 5);
    expect(res).toContain('one');
    expect(res).toContain('two');
  });

  test('n <= 0 returns empty string', () => {
    const p = path.join(outputsDir, 'teststate.md');
    const content = `alpha\n\n--- Run X ---\n\nbeta\n`;
    getFileSystem().writeFileSync(p, content, 'utf8');
    const r0 = readLatestNRuns(cwd, 'teststate', 0);
    const rNeg = readLatestNRuns(cwd, 'teststate', -1);
    expect(r0).toBe('');
    expect(rNeg).toBe('');
  });
});
