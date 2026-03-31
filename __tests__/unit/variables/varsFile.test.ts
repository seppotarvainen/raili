import path from 'path';
import {loadVarsFile} from '../../../src/cli';
import { setupFakeFs } from '../infrastructure/fsFake.util';
import { getFileSystem } from '../../../src/infrastructure/fileSystemProvider';

describe('loadVarsFile', () => {
  const TMP = '/tmp';
  const railiDir = path.join(TMP, '.raili');
  let restoreFs: () => void;

  beforeEach(() => {
    restoreFs = setupFakeFs();
    getFileSystem().mkdirSync(path.join(railiDir, 'main'), { recursive: true } as any);
  });

  afterEach(() => {
    restoreFs();
  });

  test('returns empty object when vars.yaml does not exist', () => {
    const result = loadVarsFile(TMP, ['ticket_id', 'description']);
    expect(result).toEqual({});
  });

  test('loads declared keys from vars.yaml', () => {
    getFileSystem().writeFileSync(
      path.join(railiDir, 'main', 'vars.yaml'),
      'ticket_id: PROJ-123\ndescription: Fix login bug\n'
    );
    const result = loadVarsFile(TMP, ['ticket_id', 'description']);
    expect(result).toEqual({ ticket_id: 'PROJ-123', description: 'Fix login bug' });
  });

  test('ignores keys not declared in inputs', () => {
    getFileSystem().writeFileSync(
      path.join(railiDir, 'main', 'vars.yaml'),
      'ticket_id: PROJ-123\nundeclared_key: should_be_ignored\n'
    );
    const result = loadVarsFile(TMP, ['ticket_id']);
    expect(result).toEqual({ ticket_id: 'PROJ-123' });
    expect(result).not.toHaveProperty('undeclared_key');
  });

  test('returns empty object when vars.yaml is empty', () => {
    getFileSystem().writeFileSync(path.join(railiDir, 'main', 'vars.yaml'), '');
    const result = loadVarsFile(TMP, ['ticket_id']);
    expect(result).toEqual({});
  });

  test('coerces numeric values to strings', () => {
    getFileSystem().writeFileSync(path.join(railiDir, 'main', 'vars.yaml'), 'ticket_id: 42\n');
    const result = loadVarsFile(TMP, ['ticket_id']);
    expect(result).toEqual({ ticket_id: '42' });
  });

  test('returns empty object when declared list is empty', () => {
    getFileSystem().writeFileSync(path.join(railiDir, 'main', 'vars.yaml'), 'ticket_id: PROJ-123\n');
    const result = loadVarsFile(TMP, []);
    expect(result).toEqual({});
  });

  test('only loads keys present in vars.yaml, skips missing declared keys', () => {
    getFileSystem().writeFileSync(path.join(railiDir, 'main', 'vars.yaml'), 'ticket_id: PROJ-999\n');
    const result = loadVarsFile(TMP, ['ticket_id', 'description']);
    expect(result).toEqual({ ticket_id: 'PROJ-999' });
    expect(result).not.toHaveProperty('description');
  });
});
