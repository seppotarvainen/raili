import fs from 'fs';
import path from 'path';
import os from 'os';
import { runCommand } from '../src/run';

describe('runCommand', () => {
  let tmpdir: string;
  beforeEach(() => {
    tmpdir = fs.mkdtempSync(path.join(os.tmpdir(), 'raili-test-'));
  });
  afterEach(() => {
    fs.rmSync(tmpdir, { recursive: true, force: true });
  });

  test('fails if .raili missing', async () => {
    await expect(runCommand(tmpdir)).rejects.toThrow('.raili/ directory not found');
  });

  test('fails if registries missing or invalid', async () => {
    const railiDir = path.join(tmpdir, '.raili');
    fs.mkdirSync(railiDir);
    await expect(runCommand(tmpdir)).rejects.toThrow('agent-registry.json not found');

    fs.writeFileSync(path.join(railiDir, 'agent-registry.json'), 'not json');
    fs.writeFileSync(path.join(railiDir, 'script-registry.json'), 'not json');
    await expect(runCommand(tmpdir)).rejects.toThrow('Invalid JSON');
  });

  test('returns parsed registries when valid', async () => {
    const railiDir = path.join(tmpdir, '.raili');
    fs.mkdirSync(railiDir);
    fs.writeFileSync(path.join(railiDir, 'agent-registry.json'), JSON.stringify({ a: { path: './x' } }));
    fs.writeFileSync(path.join(railiDir, 'script-registry.json'), JSON.stringify({ s: './y' }));

    const res = await runCommand(tmpdir);
    expect(res.agents).toEqual({ a: { path: './x' } });
    expect(res.scripts).toEqual({ s: './y' });
  });
});

