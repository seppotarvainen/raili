import "../../types/copilot-sdk";
import path from 'path';
import { loadAgentRegistry } from '../../../src/registry/agentRegistry';
import { executeAgent } from '../../../src/handlers/agentHandler';
import { setupFakeFs } from '../infrastructure/fsFake.util';
import { getFileSystem } from '../../../src/infrastructure/fileSystemProvider';
import { mockSession, resetCopilotSdkMock } from '@github/copilot-sdk';

jest.mock('@github/copilot-sdk');

const TMP = '/tmp';
let restoreFs: () => void;

beforeEach(() => {
  restoreFs = setupFakeFs();
  resetCopilotSdkMock();
});
afterEach(() => restoreFs());

function setupAgent() {
  const fs = getFileSystem();
  fs.mkdirSync(path.join(TMP, '.raili', 'main', 'outputs'), { recursive: true });
  const agentFile = path.join(TMP, 'agents', 'analyzer.agent.md');
  fs.mkdirSync(path.dirname(agentFile), { recursive: true });
  fs.writeFileSync(agentFile, 'Agent instructions here');
  fs.writeFileSync(
    path.join(TMP, '.raili', 'agent-registry.json'),
    JSON.stringify({ 'analyzer.agent': { path: './agents/analyzer.agent.md' } }),
  );
  return loadAgentRegistry(TMP);
}

test('does not treat legacy CLI footer text as token usage', async () => {
  const registry = setupAgent();
  const tokenLine = 'Tokens     ↑ 256.9k (223.0k cached) • ↓ 9.7k';
  mockSession.sendAndWait.mockResolvedValueOnce({
    type: 'assistant.message',
    id: 'event',
    parentId: null,
    timestamp: new Date(0).toISOString(),
    data: { content: `some output\n${tokenLine}\nend`, messageId: 'message' },
  });

  const res = await executeAgent(registry, 'analyzer.agent', TMP);

  expect(res.tokens).toMatchObject({
    input: 12,
    cached: -1,
    output: 7,
    ai_credits: 2,
    ai_time: 2,
    ai_display: 'AI Credits 2 (2s)',
  });
  expect(res.stdout).toContain('some output');
});
