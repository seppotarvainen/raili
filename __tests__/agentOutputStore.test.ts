import fs from 'fs';
import path from 'path';
import os from 'os';
import { saveAgentOutput, loadAgentOutputPath, clearAgentOutputs } from '../src/agentOutputStore';

let tmpdir: string;

beforeEach(() => {
  tmpdir = fs.mkdtempSync(path.join(os.tmpdir(), 'raili-output-'));
  fs.mkdirSync(path.join(tmpdir, '.raili'));
});

afterEach(() => {
  fs.rmSync(tmpdir, { recursive: true, force: true });
});

test('saveAgentOutput creates outputs dir and writes file on first run', () => {
  saveAgentOutput(tmpdir, 'code', 'agent was here');
  const p = path.join(tmpdir, '.raili', 'outputs', 'code.md');
  expect(fs.existsSync(p)).toBe(true);
  expect(fs.readFileSync(p, 'utf8')).toBe('agent was here');
});

test('saveAgentOutput appends with separator on subsequent runs', () => {
  saveAgentOutput(tmpdir, 'code', 'first run');
  saveAgentOutput(tmpdir, 'code', 'second run');
  const content = fs.readFileSync(path.join(tmpdir, '.raili', 'outputs', 'code.md'), 'utf8');
  expect(content).toContain('first run');
  expect(content).toContain('second run');
  expect(content).toContain('--- Run ');
});

test('saveAgentOutput accumulates all runs in order', () => {
  saveAgentOutput(tmpdir, 'code', 'run one');
  saveAgentOutput(tmpdir, 'code', 'run two');
  saveAgentOutput(tmpdir, 'code', 'run three');
  const content = fs.readFileSync(path.join(tmpdir, '.raili', 'outputs', 'code.md'), 'utf8');
  expect(content.indexOf('run one')).toBeLessThan(content.indexOf('run two'));
  expect(content.indexOf('run two')).toBeLessThan(content.indexOf('run three'));
});

test('loadAgentOutputPath returns path when file exists', () => {
  saveAgentOutput(tmpdir, 'code', 'previous output');
  const result = loadAgentOutputPath(tmpdir, 'code');
  expect(result).toBe(path.join(tmpdir, '.raili', 'outputs', 'code.md'));
});

test('loadAgentOutputPath returns null when file does not exist', () => {
  const result = loadAgentOutputPath(tmpdir, 'code');
  expect(result).toBeNull();
});

test('clearAgentOutputs deletes specified files', () => {
  saveAgentOutput(tmpdir, 'code', 'some output');
  saveAgentOutput(tmpdir, 'analyze', 'other output');
  clearAgentOutputs(tmpdir, ['code']);
  expect(loadAgentOutputPath(tmpdir, 'code')).toBeNull();
  expect(loadAgentOutputPath(tmpdir, 'analyze')).not.toBeNull();
});

test('clearAgentOutputs is silent when files do not exist', () => {
  expect(() => clearAgentOutputs(tmpdir, ['nonexistent'])).not.toThrow();
});

test('clearAgentOutputs deletes multiple files', () => {
  saveAgentOutput(tmpdir, 'code', 'c');
  saveAgentOutput(tmpdir, 'analyze', 'a');
  clearAgentOutputs(tmpdir, ['code', 'analyze']);
  expect(loadAgentOutputPath(tmpdir, 'code')).toBeNull();
  expect(loadAgentOutputPath(tmpdir, 'analyze')).toBeNull();
});

