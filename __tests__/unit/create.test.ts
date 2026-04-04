/// <reference types="node" />
/// <reference types="jest" />

import * as path from 'path';
import { parseCreateArgs } from '../../src/cli';
import { createCommand } from '../../src/cli/create';
import { setupFakeFs } from './infrastructure/fsFake.util';
import { getFileSystem } from '../../src/infrastructure/fileSystemProvider';

describe('createCommand and parseCreateArgs', () => {
  let tmpdir: string;
  let fs: any;
  beforeEach(() => {
    const restore = setupFakeFs();
    (global as any).__restoreFs = restore;
    tmpdir = path.join('/tmp', `raili-test-${Math.random().toString(36).slice(2, 8)}`);
    fs = getFileSystem();
  });
  afterEach(() => {
    const restore = (global as any).__restoreFs;
    if (restore) restore();
  });

  test('parseCreateArgs parses -w flag', () => {
    const parsed = parseCreateArgs(['-w', 'feature']);
    expect(parsed.workflow).toBe('feature');
  });

  test('parseCreateArgs throws when missing -w', () => {
    expect(() => parseCreateArgs([])).toThrow('Missing required -w');
  });

  test('createCommand creates workflow scaffold when .raili exists', async () => {
    const railiDir = path.join(tmpdir, '.raili');
    fs.mkdirSync(railiDir, { recursive: true });

    const res = await createCommand(tmpdir, 'feature');
    expect(res.created).toBe(true);
    const target = path.join(railiDir, 'feature');
    expect(fs.existsSync(target)).toBe(true);
    expect(fs.existsSync(path.join(target, 'workflow.yaml'))).toBe(true);
    expect(fs.existsSync(path.join(target, 'vars.yaml'))).toBe(true);
    expect(fs.existsSync(path.join(target, 'outputs'))).toBe(true);
    expect(fs.existsSync(path.join(target, 'learnings'))).toBe(true);
  });

  test('createCommand fails when .raili missing', async () => {
    await expect(createCommand(tmpdir, 'feature')).rejects.toThrow('.raili/ directory not found');
  });

  test('createCommand fails with invalid name', async () => {
    const railiDir = path.join(tmpdir, '.raili');
    fs.mkdirSync(railiDir, { recursive: true });
    await expect(createCommand(tmpdir, 'bad/name')).rejects.toThrow('Invalid workflow name');
  });
});
