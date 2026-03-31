/// <reference types="node" />
/// <reference types="jest" />

import * as os from 'os';
import * as path from 'path';
import { initCommand } from '../../src/init';
import { setupFakeFs } from './infrastructure/fsFake.util';
import { getFileSystem } from '../../src/infrastructure/fileSystemProvider';

describe('initCommand', () => {
  let tmpdir: string;
  let fs: any;
  beforeEach(() => {
    const restoreFs = setupFakeFs();
    (global as any).__restoreFs = restoreFs;
    tmpdir = path.join('/tmp', `raili-test-${Math.random().toString(36).slice(2, 8)}`);
    fs = getFileSystem();
  });
  afterEach(() => {
    const restore = (global as any).__restoreFs;
    if (restore) restore();
  });

  test('creates .raili with template files', async () => {
    await initCommand(tmpdir);
    const railiDir = path.join(tmpdir, '.raili');
    expect(fs.existsSync(railiDir)).toBe(true);
    expect(fs.existsSync(path.join(railiDir, 'main', 'workflow.yaml'))).toBe(true);
    expect(fs.existsSync(path.join(railiDir, 'agent-registry.json'))).toBe(true);
    expect(fs.existsSync(path.join(railiDir, 'script-registry.json'))).toBe(true);
  });

  test('fails if .raili already exists', async () => {
    const railiDir = path.join(tmpdir, '.raili');
    fs.mkdirSync(railiDir, { recursive: true });
    await expect(initCommand(tmpdir)).rejects.toThrow('.raili/ already exists');
  });
});
