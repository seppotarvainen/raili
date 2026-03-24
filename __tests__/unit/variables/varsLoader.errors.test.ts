// Targets the error-handling branches in varsLoader.ts that are not exercised
// by the real-filesystem tests in varsFile.test.ts.
import fs from 'fs';
import path from 'path';
import os from 'os';
import { loadVarsFile } from '../../../src/variables/varsLoader';

afterEach(() => {
  jest.restoreAllMocks();
});

describe('loadVarsFile error paths', () => {
  let tmpdir: string;

  beforeEach(() => {
    tmpdir = fs.mkdtempSync(path.join(os.tmpdir(), 'raili-vl-err-'));
    fs.mkdirSync(path.join(tmpdir, '.raili', 'main'), { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tmpdir, { recursive: true, force: true });
  });

  test('returns {} and warns when readFileSync throws (unreadable vars.yaml)', () => {
    // Create the file so existsSync sees it exists, then mock readFileSync to fail
    fs.writeFileSync(path.join(tmpdir, '.raili', 'main', 'vars.yaml'), 'ticket_id: PROJ-1\n');
    jest.spyOn(fs, 'readFileSync').mockImplementation(() => {
      throw new Error('permission denied');
    });

    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const result = loadVarsFile(tmpdir, ['ticket_id']);
    expect(result).toEqual({});
    expect(warnSpy).toHaveBeenCalledWith(expect.stringMatching(/Unable to read/));
  });

  test('returns {} and warns when vars.yaml contains invalid YAML', () => {
    fs.writeFileSync(
      path.join(tmpdir, '.raili', 'main', 'vars.yaml'),
      ': : invalid: yaml: :::',
    );
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const result = loadVarsFile(tmpdir, ['ticket_id']);
    expect(result).toEqual({});
    expect(warnSpy).toHaveBeenCalledWith(expect.stringMatching(/Could not parse/));
  });

  test('warns for undeclared keys and omits them from result', () => {
    fs.writeFileSync(
      path.join(tmpdir, '.raili', 'main', 'vars.yaml'),
      'ticket_id: T-1\nextra_var: ignored\n',
    );
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const result = loadVarsFile(tmpdir, ['ticket_id']);
    expect(result).toEqual({ ticket_id: 'T-1' });
    expect(warnSpy).toHaveBeenCalledWith(expect.stringMatching(/extra_var/));
  });

  test('falls back to .raili/vars.yaml when workflow vars.yaml is empty', () => {
    fs.writeFileSync(path.join(tmpdir, '.raili', 'main', 'vars.yaml'), '');
    fs.writeFileSync(path.join(tmpdir, '.raili', 'vars.yaml'), 'ticket_id: FALLBACK-1\n');
    const result = loadVarsFile(tmpdir, ['ticket_id']);
    expect(result).toEqual({ ticket_id: 'FALLBACK-1' });
  });
});
