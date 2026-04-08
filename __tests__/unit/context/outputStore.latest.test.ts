import * as path from 'path';
import { setupFakeFs } from '../infrastructure/fsFake.util';
import { getFileSystem } from '../../../src/infrastructure/fileSystemProvider';
import { saveLatestOutput, saveOutput } from '../../../src/context/outputStore';

describe('saveLatestOutput', () => {
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

  test('writes .latest.md with filtered content and correct filename (uses final segment of stateId)', () => {
    const out = `Intro\n//SUMMARY//\n- Point A\n- Point B\n//SUMMARY_END//\nFooter`;
    saveLatestOutput(cwd, 'group.sub', out, { store: true, marker: '//SUMMARY//', marker_end: '//SUMMARY_END//' }, 'main');

    const p = path.join(outputsDir, 'sub.latest.md');
    expect(getFileSystem().existsSync(p)).toBe(true);
    const content = getFileSystem().readFileSync(p, 'utf8');
    expect(content).toBe('- Point A\n- Point B');
  });

  test('returns early when outputConfig.store is false', () => {
    const out = 'Some output';
    saveLatestOutput(cwd, 'state', out, { store: false }, 'main');
    const p = path.join(outputsDir, 'state.latest.md');
    expect(getFileSystem().existsSync(p)).toBe(false);
  });

  test('returns early when filtered output is empty', () => {
    const out = `Header\n//EMPTY//\n\n//EMPTY_END//\nFooter`;
    saveLatestOutput(cwd, 'state', out, { store: true, marker: '//EMPTY//', marker_end: '//EMPTY_END//' }, 'main');
    const p = path.join(outputsDir, 'state.latest.md');
    expect(getFileSystem().existsSync(p)).toBe(false);
  });

  test('saveOutput calls saveLatestOutput and overwrites existing latest file', () => {
    const initial = 'old content';
    const latestPath = path.join(outputsDir, 'state.latest.md');
    getFileSystem().writeFileSync(latestPath, initial, 'utf8');

    // call saveOutput which should append history and then overwrite latest
    const out = `Marker:\nL1\nL2\nL3`;
    saveOutput(cwd, 'state', out, { store: true, marker: 'Marker:' }, 'main');

    expect(getFileSystem().existsSync(latestPath)).toBe(true);
    const newContent = getFileSystem().readFileSync(latestPath, 'utf8');
    expect(newContent).toBe('L1\nL2\nL3');
  });
});
