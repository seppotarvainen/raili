import fs from 'fs';
import path from 'path';
import { loadAgentRegistry } from '../src/agentRegistry';
import { executeAgent } from '../src/handlers/agentHandler';

const TMP = path.resolve(__dirname, 'tmp_handler');
beforeAll(() => { if (!fs.existsSync(TMP)) fs.mkdirSync(TMP); });
afterAll(() => { if (fs.existsSync(TMP)) fs.rmSync(TMP, { recursive: true }); });

test('executeAgent returns mocked output', () => {
  const agentDir = path.join(TMP, '.raili');
  fs.mkdirSync(agentDir);
  const agentFile = path.join(TMP, 'agents', 'analyzer.agent.md');
  fs.mkdirSync(path.dirname(agentFile), { recursive: true });
  fs.writeFileSync(agentFile, 'AGENT FRONTMATTER\nrest of file');
  const reg = { 'analyzer.agent': { path: './agents/analyzer.agent.md' } };
  fs.writeFileSync(path.join(agentDir, 'agent-registry.json'), JSON.stringify(reg));

  const loaded = loadAgentRegistry(TMP);
  const res = executeAgent(loaded, 'analyzer.agent', TMP);
  expect(res.success).toBe(true);
  expect(res.output).toContain('MOCKED_AGENT_OUTPUT');
});
