import fs from 'fs';
import path from 'path';
import { loadScriptRegistry } from '../src/scriptRegistry';
import { executeScript } from '../src/handlers/scriptHandler';

const TMP = path.resolve(__dirname, 'tmp_script_handler');
beforeAll(() => { if (!fs.existsSync(TMP)) fs.mkdirSync(TMP); });
afterAll(() => { if (fs.existsSync(TMP)) fs.rmSync(TMP, { recursive: true }); });

test('executeScript returns mocked output', () => {
  const raidir = path.join(TMP, '.raili');
  fs.mkdirSync(raidir);
  const scriptFile = path.join(TMP, 'scripts', 'archive.sh');
  fs.mkdirSync(path.dirname(scriptFile), { recursive: true });
  fs.writeFileSync(scriptFile, 'echo hello');
  const reg = { 'archive-part': { path: './scripts/archive.sh' } };
  fs.writeFileSync(path.join(raidir, 'script-registry.json'), JSON.stringify(reg));

  const loaded = loadScriptRegistry(TMP);
  const res = executeScript(loaded, 'archive-part', TMP);
  expect(res.success).toBe(true);
  expect(res.output).toContain('MOCKED_SCRIPT_OUTPUT');
});
