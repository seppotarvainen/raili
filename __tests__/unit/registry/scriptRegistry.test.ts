import path from 'path';
import { setupFakeFs } from '../infrastructure/fsFake.util';
import { getFileSystem } from '../../../src/infrastructure/fileSystemProvider';
import { loadScriptRegistry } from '../../../src/registry/scriptRegistry';

let restoreFs: () => void;
const TMP = '/tmp';

beforeAll(() => { restoreFs = setupFakeFs(); });
afterAll(() => { restoreFs(); });

test('loads valid script registry', () => {
  const reg = { 'archive-part': { path: './scripts/archive.sh' } };
  const rail = path.join(TMP, '.raili');
  getFileSystem().mkdirSync(rail, { recursive: true } as any);
  getFileSystem().writeFileSync(path.join(rail, 'script-registry.json'), JSON.stringify(reg));
  const loaded = loadScriptRegistry(TMP);
  expect(loaded['archive-part'].path).toBe('./scripts/archive.sh');
});

test('loads an optional script runtime', () => {
  const reg = { example: { path: './scripts/example.js', runtime: 'node' } };
  const rail = path.join(TMP, '.raili');
  getFileSystem().writeFileSync(path.join(rail, 'script-registry.json'), JSON.stringify(reg));
  const loaded = loadScriptRegistry(TMP);
  expect(loaded.example.runtime).toBe('node');
});

test.each([
  ['a non-string runtime', 42],
  ['an empty runtime', ''],
  ['a whitespace-only runtime', '   '],
])('throws on %s', (_description, runtime) => {
  const reg = { example: { path: './scripts/example.js', runtime } };
  const rail = path.join(TMP, '.raili');
  getFileSystem().writeFileSync(path.join(rail, 'script-registry.json'), JSON.stringify(reg));
  expect(() => loadScriptRegistry(TMP)).toThrow(
    "Invalid script registry entry for 'example': runtime must be a non-empty string",
  );
});

test('throws on missing file', () => {
  const dir = path.join(TMP, 'missing');
  getFileSystem().mkdirSync(dir, { recursive: true } as any);
  expect(() => loadScriptRegistry(dir)).toThrow();
});
