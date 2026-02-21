import fs from 'fs';
import path from 'path';
import { validateAgentRegistry, validateScriptRegistry } from '../src/registryValidator';

const TMP = path.resolve(__dirname, 'tmp_registry');
beforeAll(() => { if (!fs.existsSync(TMP)) fs.mkdirSync(TMP); });
afterAll(() => { if (fs.existsSync(TMP)) fs.rmSync(TMP, { recursive: true }); });

test('validates agent registry and files exist', () => {
  const raildir = path.join(TMP, '.raili');
  fs.mkdirSync(raildir);
  const agentFile = path.join(TMP, 'agents', 'a.md');
  fs.mkdirSync(path.dirname(agentFile), { recursive: true });
  fs.writeFileSync(agentFile, 'content');
  const reg = { 'a.agent': { path: './agents/a.md' } };
  fs.writeFileSync(path.join(raildir, 'agent-registry.json'), JSON.stringify(reg));
  expect(() => validateAgentRegistry(TMP)).not.toThrow();
});

test('throws when script file missing', () => {
  const raildir = path.join(TMP, '.raili');
  fs.mkdirSync(raildir, { recursive: true });
  const reg = { 's.part': { path: './scripts/missing.sh' } };
  fs.writeFileSync(path.join(raildir, 'script-registry.json'), JSON.stringify(reg));
  expect(() => validateScriptRegistry(TMP)).toThrow();
});
