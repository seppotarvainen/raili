import * as path from 'path';
import { setupFakeFs } from '../infrastructure/fsFake.util';
import { getFileSystem } from '../../../src/infrastructure/fileSystemProvider';
import {clearAgentOutputs, clearAllOutputs, loadAgentOutputPath, saveOutput} from '../../../src/context/outputStore';

let tmpdir: string;
let restoreFs: () => void;

beforeEach(() => {
  restoreFs = setupFakeFs();
  tmpdir = '/tmp/test-workspace';
  getFileSystem().mkdirSync(path.join(tmpdir, '.raili', 'main'), { recursive: true } as any);
});

afterEach(() => {
  restoreFs();
});

test('saveOutput creates outputs dir and writes file on first run', () => {
  saveOutput(tmpdir, 'code', 'agent was here', { store: true });
  const p = path.join(tmpdir, '.raili', 'main', 'outputs', 'code.md');
  expect(getFileSystem().existsSync(p)).toBe(true);
  expect(getFileSystem().readFileSync(p, 'utf8')).toBe('agent was here');
});

test('saveOutput appends with separator on subsequent runs', () => {
  saveOutput(tmpdir, 'code', 'first run', { store: true });
  saveOutput(tmpdir, 'code', 'second run', { store: true });
  const content = getFileSystem().readFileSync(path.join(tmpdir, '.raili', 'main', 'outputs', 'code.md'), 'utf8');
  expect(content).toContain('first run');
  expect(content).toContain('second run');
  expect(content).toContain('--- Run ');
});

test('saveOutput accumulates all runs in order', () => {
  saveOutput(tmpdir, 'code', 'run one', { store: true });
  saveOutput(tmpdir, 'code', 'run two', { store: true });
  saveOutput(tmpdir, 'code', 'run three', { store: true });
  const content = getFileSystem().readFileSync(path.join(tmpdir, '.raili', 'main', 'outputs', 'code.md'), 'utf8');
  expect(content.indexOf('run one')).toBeLessThan(content.indexOf('run two'));
  expect(content.indexOf('run two')).toBeLessThan(content.indexOf('run three'));
});

test('loadAgentOutputPath returns path when file exists', () => {
  saveOutput(tmpdir, 'code', 'previous output', { store: true });
  const result = loadAgentOutputPath(tmpdir, 'code');
  expect(result).toBe(path.join(tmpdir, '.raili', 'main', 'outputs', 'code.md'));
});

test('loadAgentOutputPath returns null when file does not exist', () => {
  const result = loadAgentOutputPath(tmpdir, 'code');
  expect(result).toBeNull();
});

test('clearAgentOutputs deletes specified files including .latest.md', () => {
  saveOutput(tmpdir, 'code', 'some output', { store: true });
  saveOutput(tmpdir, 'analyze', 'other output', { store: true });
  const latestPath = path.join(tmpdir, '.raili', 'main', 'outputs', 'code.latest.md');
  expect(getFileSystem().existsSync(latestPath)).toBe(true);

  clearAgentOutputs(tmpdir, ['code']);

  expect(loadAgentOutputPath(tmpdir, 'code')).toBeNull();
  expect(getFileSystem().existsSync(latestPath)).toBe(false);
  expect(loadAgentOutputPath(tmpdir, 'analyze')).not.toBeNull();
});

test('clearAgentOutputs is silent when files do not exist', () => {
  expect(() => clearAgentOutputs(tmpdir, ['nonexistent'])).not.toThrow();
});

test('clearAgentOutputs deletes multiple files including their latest variants', () => {
  saveOutput(tmpdir, 'code', 'c', { store: true });
  saveOutput(tmpdir, 'analyze', 'a', { store: true });
  const latestCode = path.join(tmpdir, '.raili', 'main', 'outputs', 'code.latest.md');
  const latestAnalyze = path.join(tmpdir, '.raili', 'main', 'outputs', 'analyze.latest.md');
  expect(getFileSystem().existsSync(latestCode)).toBe(true);
  expect(getFileSystem().existsSync(latestAnalyze)).toBe(true);

  clearAgentOutputs(tmpdir, ['code', 'analyze']);
  expect(loadAgentOutputPath(tmpdir, 'code')).toBeNull();
  expect(getFileSystem().existsSync(latestCode)).toBe(false);
  expect(loadAgentOutputPath(tmpdir, 'analyze')).toBeNull();
  expect(getFileSystem().existsSync(latestAnalyze)).toBe(false);
});

test('clearAgentOutputs handles group sub-states by using final segment', () => {
  // create files named 'sub.md' and 'sub.latest.md'
  saveOutput(tmpdir, 'sub', 's', { store: true });
  const latestSub = path.join(tmpdir, '.raili', 'main', 'outputs', 'sub.latest.md');
  expect(getFileSystem().existsSync(latestSub)).toBe(true);

  // ask to clear 'group.sub' - should remove 'sub.md' and 'sub.latest.md'
  clearAgentOutputs(tmpdir, ['group.sub']);
  expect(loadAgentOutputPath(tmpdir, 'sub')).toBeNull();
  expect(getFileSystem().existsSync(latestSub)).toBe(false);
});

test('clearAllOutputs removes entire outputs directory', () => {
  saveOutput(tmpdir, 'code', 'output 1', { store: true });
  saveOutput(tmpdir, 'analyze', 'output 2', { store: true });
  saveOutput(tmpdir, 'plan', 'output 3', { store: true });

  const outputsDir = path.join(tmpdir, '.raili', 'main', 'outputs');
  expect(getFileSystem().existsSync(outputsDir)).toBe(true);

  clearAllOutputs(tmpdir);

  expect(getFileSystem().existsSync(outputsDir)).toBe(false);
  expect(loadAgentOutputPath(tmpdir, 'code')).toBeNull();
  expect(loadAgentOutputPath(tmpdir, 'analyze')).toBeNull();
  expect(loadAgentOutputPath(tmpdir, 'plan')).toBeNull();
});

test('clearAllOutputs is silent when outputs directory does not exist', () => {
  expect(() => clearAllOutputs(tmpdir)).not.toThrow();
});
