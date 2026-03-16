/// <reference types="node" />
/// <reference types="jest" />

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { initCommand } from '../../src/init';

describe('initCommand', () => {
  let tmpdir: string;
  beforeEach(() => {
    tmpdir = fs.mkdtempSync(path.join(os.tmpdir(), 'raili-test-'));
  });
  afterEach(() => {
    // remove tmpdir recursively
    fs.rmSync(tmpdir, { recursive: true, force: true });
  });

  test('creates .raili with template files', async () => {
    await initCommand(tmpdir);
    const railiDir = path.join(tmpdir, '.raili');
    expect(fs.existsSync(railiDir)).toBe(true);
    expect(fs.existsSync(path.join(railiDir, 'workflow.yaml'))).toBe(true);
    expect(fs.existsSync(path.join(railiDir, 'agent-registry.json'))).toBe(true);
    expect(fs.existsSync(path.join(railiDir, 'script-registry.json'))).toBe(true);
  });

  test('fails if .raili already exists', async () => {
    const railiDir = path.join(tmpdir, '.raili');
    fs.mkdirSync(railiDir);
    await expect(initCommand(tmpdir)).rejects.toThrow('.raili/ already exists');
  });
});
