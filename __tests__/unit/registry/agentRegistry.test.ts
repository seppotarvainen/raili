import fs from 'fs';
import os from 'os';
import path from 'path';
import {loadAgentRegistry} from '../../../src/registry/agentRegistry';

let TMP: string;
beforeAll(() => { TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'raili-areg-')); });
afterAll(() => { if (fs.existsSync(TMP)) fs.rmSync(TMP, { recursive: true }); });

test('loads valid registry', () => {
  const reg = { 'analyzer.agent': { path: './agents/analyzer.agent.md' } };
  fs.mkdirSync(path.join(TMP, '.raili'));
  fs.writeFileSync(path.join(TMP, '.raili', 'agent-registry.json'), JSON.stringify(reg));
  const loaded = loadAgentRegistry(TMP);
  expect(loaded['analyzer.agent'].path).toBe('./agents/analyzer.agent.md');
});

test('throws on missing file', () => {
  const dir = path.join(TMP, 'missing');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir);
  expect(() => loadAgentRegistry(dir)).toThrow();
});
