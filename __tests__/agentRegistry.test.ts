import fs from 'fs';
import path from 'path';
import { loadAgentRegistry } from '../src/agentRegistry';

const TMP = path.resolve(__dirname, 'tmp');
beforeAll(() => { if (!fs.existsSync(TMP)) fs.mkdirSync(TMP); });
afterAll(() => { if (fs.existsSync(TMP)) fs.rmSync(TMP, { recursive: true }); });

test('loads valid registry', () => {
  const reg = { 'analyzer.agent': { path: './agents/analyzer.agent.md' } };
  fs.writeFileSync(path.join(TMP, '.raili'), '');
  fs.writeFileSync(path.join(TMP, '.raili', 'agent-registry.json'), JSON.stringify(reg));
  const loaded = loadAgentRegistry(TMP);
  expect(loaded['analyzer.agent'].path).toBe('./agents/analyzer.agent.md');
});

test('throws on missing file', () => {
  const dir = path.join(TMP, 'missing');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir);
  expect(() => loadAgentRegistry(dir)).toThrow();
});
