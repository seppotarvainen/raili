import fs from 'fs';
import path from 'path';
import os from 'os';
import { runCommand } from '../src/run';

jest.mock('../src/registryValidator');
const registryValidator = require('../src/registryValidator');

describe('runCommand', () => {
  let tmpdir: string;
  beforeEach(() => {
    tmpdir = fs.mkdtempSync(path.join(os.tmpdir(), 'raili-test-'));
    jest.resetAllMocks();
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

    // simulate validator throwing on invalid JSON
    registryValidator.validateAgentRegistry.mockImplementation(() => { throw new Error('Agent registry JSON parse error'); });
    registryValidator.validateScriptRegistry.mockImplementation(() => { throw new Error('Script registry JSON parse error'); });

    fs.writeFileSync(path.join(railiDir, 'agent-registry.json'), 'not json');
    fs.writeFileSync(path.join(railiDir, 'script-registry.json'), 'not json');
    await expect(runCommand(tmpdir)).rejects.toThrow('Agent registry JSON parse error');
  });

  test('returns parsed registries when valid', async () => {
    const railiDir = path.join(tmpdir, '.raili');
    fs.mkdirSync(railiDir);
    fs.writeFileSync(path.join(railiDir, 'agent-registry.json'), JSON.stringify({ a: { path: './x' } }));
    fs.writeFileSync(path.join(railiDir, 'script-registry.json'), JSON.stringify({ s: { path: './y' } }));

    // mock validators to avoid touching filesystem
    registryValidator.validateAgentRegistry.mockImplementation(() => ({ a: { path: './x' } }));
    registryValidator.validateScriptRegistry.mockImplementation(() => ({ s: { path: './y' } }));

    const res = await runCommand(tmpdir);
    expect(res.agents).toEqual({ a: { path: './x' } });
    expect(res.scripts).toEqual({ s: { path: './y' } });
  });
});

