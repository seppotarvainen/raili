// Targets the error-handling branches in varsLoader.ts that are not exercised
// by the real-filesystem tests in varsFile.test.ts.
import path from 'path';
import { loadVarsFile } from '../../../src/variables/varsLoader';
import { setupFakeFs } from '../infrastructure/fsFake.util';
import { getFileSystem } from '../../../src/infrastructure/fileSystemProvider';

afterEach(() => {
  jest.restoreAllMocks();
});

describe('loadVarsFile error paths', () => {
  const TMP = '/tmp';
  let restoreFs: () => void;

  beforeEach(() => {
    restoreFs = setupFakeFs();
    getFileSystem().mkdirSync(path.join(TMP, '.raili', 'main'), { recursive: true } as any);
  });

  afterEach(() => {
    restoreFs();
  });

  test('returns {} and warns when readFileSync throws (unreadable vars.yaml)', () => {
    // Create the file so existsSync sees it exists, then mock readFileSync to fail
    getFileSystem().writeFileSync(path.join(TMP, '.raili', 'main', 'vars.yaml'), 'ticket_id: PROJ-1\n');
    jest.spyOn(getFileSystem() as any, 'readFileSync').mockImplementation(() => {
      throw new Error('permission denied');
    });

    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const result = loadVarsFile(TMP, ['ticket_id']);
    expect(result).toEqual({});
    expect(warnSpy).toHaveBeenCalledWith(expect.stringMatching(/Unable to read/));
  });

  test('returns {} and warns when vars.yaml contains invalid YAML', () => {
    getFileSystem().writeFileSync(
      path.join(TMP, '.raili', 'main', 'vars.yaml'),
      ': : invalid: yaml: :::',
    );
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const result = loadVarsFile(TMP, ['ticket_id']);
    expect(result).toEqual({});
    expect(warnSpy).toHaveBeenCalledWith(expect.stringMatching(/Could not parse/));
  });

  test('warns for undeclared keys and omits them from result', () => {
    getFileSystem().writeFileSync(
      path.join(TMP, '.raili', 'main', 'vars.yaml'),
      'ticket_id: T-1\nextra_var: ignored\n',
    );
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const result = loadVarsFile(TMP, ['ticket_id']);
    expect(result).toEqual({ ticket_id: 'T-1' });
    expect(warnSpy).toHaveBeenCalledWith(expect.stringMatching(/extra_var/));
  });

  test('falls back to .raili/vars.yaml when workflow vars.yaml is empty', () => {
    getFileSystem().writeFileSync(path.join(TMP, '.raili', 'main', 'vars.yaml'), '');
    getFileSystem().writeFileSync(path.join(TMP, '.raili', 'vars.yaml'), 'ticket_id: FALLBACK-1\n');
    const result = loadVarsFile(TMP, ['ticket_id']);
    expect(result).toEqual({ ticket_id: 'FALLBACK-1' });
  });
});
