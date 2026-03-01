import fs from 'fs';
import path from 'path';
import os from 'os';
import { loadVarsFile } from '../src/cli';

describe('loadVarsFile', () => {
  let tmpdir: string;
  let railiDir: string;

  beforeEach(() => {
    tmpdir = fs.mkdtempSync(path.join(os.tmpdir(), 'raili-vars-test-'));
    railiDir = path.join(tmpdir, '.raili');
    fs.mkdirSync(railiDir);
  });

  afterEach(() => {
    fs.rmSync(tmpdir, { recursive: true, force: true });
  });

  test('returns empty object when vars.yaml does not exist', () => {
    const result = loadVarsFile(tmpdir, ['ticket_id', 'description']);
    expect(result).toEqual({});
  });

  test('loads declared keys from vars.yaml', () => {
    fs.writeFileSync(
      path.join(railiDir, 'vars.yaml'),
      'ticket_id: PROJ-123\ndescription: Fix login bug\n'
    );
    const result = loadVarsFile(tmpdir, ['ticket_id', 'description']);
    expect(result).toEqual({ ticket_id: 'PROJ-123', description: 'Fix login bug' });
  });

  test('ignores keys not declared in inputs', () => {
    fs.writeFileSync(
      path.join(railiDir, 'vars.yaml'),
      'ticket_id: PROJ-123\nundeclared_key: should_be_ignored\n'
    );
    const result = loadVarsFile(tmpdir, ['ticket_id']);
    expect(result).toEqual({ ticket_id: 'PROJ-123' });
    expect(result).not.toHaveProperty('undeclared_key');
  });

  test('returns empty object when vars.yaml is empty', () => {
    fs.writeFileSync(path.join(railiDir, 'vars.yaml'), '');
    const result = loadVarsFile(tmpdir, ['ticket_id']);
    expect(result).toEqual({});
  });

  test('coerces numeric values to strings', () => {
    fs.writeFileSync(path.join(railiDir, 'vars.yaml'), 'ticket_id: 42\n');
    const result = loadVarsFile(tmpdir, ['ticket_id']);
    expect(result).toEqual({ ticket_id: '42' });
  });

  test('returns empty object when declared list is empty', () => {
    fs.writeFileSync(path.join(railiDir, 'vars.yaml'), 'ticket_id: PROJ-123\n');
    const result = loadVarsFile(tmpdir, []);
    expect(result).toEqual({});
  });

  test('only loads keys present in vars.yaml, skips missing declared keys', () => {
    fs.writeFileSync(path.join(railiDir, 'vars.yaml'), 'ticket_id: PROJ-999\n');
    const result = loadVarsFile(tmpdir, ['ticket_id', 'description']);
    expect(result).toEqual({ ticket_id: 'PROJ-999' });
    expect(result).not.toHaveProperty('description');
  });
});

