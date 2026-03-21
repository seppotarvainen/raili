import fs from 'fs';
import os from 'os';
import path from 'path';
import {loadScriptRegistry} from '../../src/registry/scriptRegistry';

let TMP: string;
beforeAll(() => { TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'raili-sreg-')); });
afterAll(() => { if (fs.existsSync(TMP)) fs.rmSync(TMP, { recursive: true }); });

test('loads valid script registry', () => {
  const reg = { 'archive-part': { path: './scripts/archive.sh' } };
  fs.mkdirSync(path.join(TMP, '.raili'));
  fs.writeFileSync(path.join(TMP, '.raili', 'script-registry.json'), JSON.stringify(reg));
  const loaded = loadScriptRegistry(TMP);
  expect(loaded['archive-part'].path).toBe('./scripts/archive.sh');
});

test('throws on missing file', () => {
  const dir = path.join(TMP, 'missing');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir);
  expect(() => loadScriptRegistry(dir)).toThrow();
});
