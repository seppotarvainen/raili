import fs from 'fs';
import path from 'path';
import os from 'os';
import {clearAgentOutputs, clearAllOutputs, loadAgentOutputPath, saveOutput} from '../../../src/context/outputStore';

let tmpdir: string;

beforeEach(() => {
  tmpdir = fs.mkdtempSync(path.join(os.tmpdir(), 'raili-output-'));
  fs.mkdirSync(path.join(tmpdir, '.raili', 'main'), { recursive: true });
});

afterEach(() => {
  fs.rmSync(tmpdir, { recursive: true, force: true });
});

test('saveOutput creates outputs dir and writes file on first run', () => {
  saveOutput(tmpdir, 'code', 'agent was here', { store: true });
  const p = path.join(tmpdir, '.raili', 'main', 'outputs', 'code.md');
  expect(fs.existsSync(p)).toBe(true);
  expect(fs.readFileSync(p, 'utf8')).toBe('agent was here');
});

test('saveOutput appends with separator on subsequent runs', () => {
  saveOutput(tmpdir, 'code', 'first run', { store: true });
  saveOutput(tmpdir, 'code', 'second run', { store: true });
  const content = fs.readFileSync(path.join(tmpdir, '.raili', 'main', 'outputs', 'code.md'), 'utf8');
  expect(content).toContain('first run');
  expect(content).toContain('second run');
  expect(content).toContain('--- Run ');
});

test('saveOutput accumulates all runs in order', () => {
  saveOutput(tmpdir, 'code', 'run one', { store: true });
  saveOutput(tmpdir, 'code', 'run two', { store: true });
  saveOutput(tmpdir, 'code', 'run three', { store: true });
  const content = fs.readFileSync(path.join(tmpdir, '.raili', 'main', 'outputs', 'code.md'), 'utf8');
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

test('clearAgentOutputs deletes specified files', () => {
  saveOutput(tmpdir, 'code', 'some output', { store: true });
  saveOutput(tmpdir, 'analyze', 'other output', { store: true });
  clearAgentOutputs(tmpdir, ['code']);
  expect(loadAgentOutputPath(tmpdir, 'code')).toBeNull();
  expect(loadAgentOutputPath(tmpdir, 'analyze')).not.toBeNull();
});

test('clearAgentOutputs is silent when files do not exist', () => {
  expect(() => clearAgentOutputs(tmpdir, ['nonexistent'])).not.toThrow();
});

test('clearAgentOutputs deletes multiple files', () => {
  saveOutput(tmpdir, 'code', 'c', { store: true });
  saveOutput(tmpdir, 'analyze', 'a', { store: true });
  clearAgentOutputs(tmpdir, ['code', 'analyze']);
  expect(loadAgentOutputPath(tmpdir, 'code')).toBeNull();
  expect(loadAgentOutputPath(tmpdir, 'analyze')).toBeNull();
});

test('clearAllOutputs removes entire outputs directory', () => {
  saveOutput(tmpdir, 'code', 'output 1', { store: true });
  saveOutput(tmpdir, 'analyze', 'output 2', { store: true });
  saveOutput(tmpdir, 'plan', 'output 3', { store: true });

  const outputsDir = path.join(tmpdir, '.raili', 'main', 'outputs');
  expect(fs.existsSync(outputsDir)).toBe(true);

  clearAllOutputs(tmpdir);

  expect(fs.existsSync(outputsDir)).toBe(false);
  expect(loadAgentOutputPath(tmpdir, 'code')).toBeNull();
  expect(loadAgentOutputPath(tmpdir, 'analyze')).toBeNull();
  expect(loadAgentOutputPath(tmpdir, 'plan')).toBeNull();
});

test('clearAllOutputs is silent when outputs directory does not exist', () => {
  expect(() => clearAllOutputs(tmpdir)).not.toThrow();
});
