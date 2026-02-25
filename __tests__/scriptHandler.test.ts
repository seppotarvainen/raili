import fs from 'fs';
import path from 'path';
import { loadScriptRegistry } from '../src/scriptRegistry';
import { executeScript } from '../src/handlers/scriptHandler';

const TMP = path.resolve(__dirname, 'tmp_script_handler');
beforeAll(() => { if (!fs.existsSync(TMP)) fs.mkdirSync(TMP); });
afterAll(() => { if (fs.existsSync(TMP)) fs.rmSync(TMP, { recursive: true }); });

test('executeScript runs the script and returns stdout', () => {
  const raidir = path.join(TMP, '.raili');
  if (!fs.existsSync(raidir)) fs.mkdirSync(raidir);
  const scriptFile = path.join(TMP, 'scripts', 'archive.sh');
  fs.mkdirSync(path.dirname(scriptFile), { recursive: true });
  fs.writeFileSync(scriptFile, 'echo hello', { mode: 0o755 });
  const reg = { 'archive-part': { path: './scripts/archive.sh' } };
  fs.writeFileSync(path.join(raidir, 'script-registry.json'), JSON.stringify(reg));

  const loaded = loadScriptRegistry(TMP);
  const res = executeScript(loaded, 'archive-part', TMP);
  expect(res.success).toBe(true);
  expect(res.output.trim()).toBe('hello');
});

test('executeScript returns failure on non-zero exit', () => {
  const raidir = path.join(TMP, '.raili');
  if (!fs.existsSync(raidir)) fs.mkdirSync(raidir);
  const scriptFile = path.join(TMP, 'scripts', 'failing.sh');
  fs.mkdirSync(path.dirname(scriptFile), { recursive: true });
  fs.writeFileSync(scriptFile, 'echo error msg >&2\nexit 1', { mode: 0o755 });
  const reg = { 'fail-script': { path: './scripts/failing.sh' } };
  fs.writeFileSync(path.join(raidir, 'script-registry.json'), JSON.stringify(reg));

  const loaded = loadScriptRegistry(TMP);
  const res = executeScript(loaded, 'fail-script', TMP);
  expect(res.success).toBe(false);
  expect(res.output).toContain('error msg');
});
