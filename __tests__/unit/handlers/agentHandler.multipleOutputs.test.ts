import "../../types/copilot-sdk";
import path from 'path';
import { loadAgentRegistry } from '../../../src/registry/agentRegistry';
import { executeAgent } from '../../../src/handlers/agentHandler';
import { setupFakeFs } from '../infrastructure/fsFake.util';
import { getFileSystem } from '../../../src/infrastructure/fileSystemProvider';
import { mockSession, resetCopilotSdkMock } from '@github/copilot-sdk';

jest.mock('@github/copilot-sdk');
jest.mock('../../../src/context/outputStore', () => ({ readLatestNRuns: jest.fn() }));
import { readLatestNRuns } from '../../../src/context/outputStore';

const TMP = '/tmp';
let restoreFs: () => void;

beforeEach(() => {
  restoreFs = setupFakeFs();
  resetCopilotSdkMock();
  jest.clearAllMocks();
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

function outputFile() {
  const file = path.join(TMP, '.raili', 'main', 'outputs', 'analyzer.md');
  getFileSystem().writeFileSync(file, 'placeholder');
  return file;
}

test('injects all stored runs when useLatest is undefined', async () => {
  (readLatestNRuns as jest.Mock).mockReturnValue(
    'first run output\n--- Run X ---\nsecond run output\n--- Run Y ---\nthird run output',
  );
  await executeAgent(setupAgent(), 'analyzer.agent', TMP, outputFile());
  const prompt = mockSession.sendAndWait.mock.calls[0][0].prompt;
  expect(prompt).toContain('first run output');
  expect(prompt).toContain('second run output');
  expect(prompt).toContain('third run output');
});

test('injects only the latest N runs when useLatest is provided', async () => {
  (readLatestNRuns as jest.Mock).mockReturnValue('second run output\n--- Run Y ---\nthird run output');
  await executeAgent(setupAgent(), 'analyzer.agent', TMP, outputFile(), undefined, 2);
  const prompt = mockSession.sendAndWait.mock.calls[0][0].prompt;
  expect(prompt).toContain('second run output');
  expect(prompt).toContain('third run output');
  expect(prompt).not.toContain('first run output');
});
