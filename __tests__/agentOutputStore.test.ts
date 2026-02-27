import fs from 'fs';
import path from 'path';
import os from 'os';
import { saveOutput, loadAgentOutputPath, clearAgentOutputs } from '../src/outputStore';

let tmpdir: string;

beforeEach(() => {
  tmpdir = fs.mkdtempSync(path.join(os.tmpdir(), 'raili-output-'));
  fs.mkdirSync(path.join(tmpdir, '.raili'));
});

afterEach(() => {
  fs.rmSync(tmpdir, { recursive: true, force: true });
});

test('saveOutput creates outputs dir and writes file on first run', () => {
  saveOutput(tmpdir, 'code', 'agent was here');
  const p = path.join(tmpdir, '.raili', 'outputs', 'code.md');
  expect(fs.existsSync(p)).toBe(true);
  expect(fs.readFileSync(p, 'utf8')).toBe('agent was here');
});

test('saveOutput appends with separator on subsequent runs', () => {
  saveOutput(tmpdir, 'code', 'first run');
  saveOutput(tmpdir, 'code', 'second run');
  const content = fs.readFileSync(path.join(tmpdir, '.raili', 'outputs', 'code.md'), 'utf8');
  expect(content).toContain('first run');
  expect(content).toContain('second run');
  expect(content).toContain('--- Run ');
});

test('saveOutput accumulates all runs in order', () => {
  saveOutput(tmpdir, 'code', 'run one');
  saveOutput(tmpdir, 'code', 'run two');
  saveOutput(tmpdir, 'code', 'run three');
  const content = fs.readFileSync(path.join(tmpdir, '.raili', 'outputs', 'code.md'), 'utf8');
  expect(content.indexOf('run one')).toBeLessThan(content.indexOf('run two'));
  expect(content.indexOf('run two')).toBeLessThan(content.indexOf('run three'));
});

test('loadAgentOutputPath returns path when file exists', () => {
  saveOutput(tmpdir, 'code', 'previous output');
  const result = loadAgentOutputPath(tmpdir, 'code');
  expect(result).toBe(path.join(tmpdir, '.raili', 'outputs', 'code.md'));
});

test('loadAgentOutputPath returns null when file does not exist', () => {
  const result = loadAgentOutputPath(tmpdir, 'code');
  expect(result).toBeNull();
});

test('clearAgentOutputs deletes specified files', () => {
  saveOutput(tmpdir, 'code', 'some output');
  saveOutput(tmpdir, 'analyze', 'other output');
  clearAgentOutputs(tmpdir, ['code']);
  expect(loadAgentOutputPath(tmpdir, 'code')).toBeNull();
  expect(loadAgentOutputPath(tmpdir, 'analyze')).not.toBeNull();
});

test('clearAgentOutputs is silent when files do not exist', () => {
  expect(() => clearAgentOutputs(tmpdir, ['nonexistent'])).not.toThrow();
});

test('clearAgentOutputs deletes multiple files', () => {
  saveOutput(tmpdir, 'code', 'c');
  saveOutput(tmpdir, 'analyze', 'a');
  clearAgentOutputs(tmpdir, ['code', 'analyze']);
  expect(loadAgentOutputPath(tmpdir, 'code')).toBeNull();
  expect(loadAgentOutputPath(tmpdir, 'analyze')).toBeNull();
});
