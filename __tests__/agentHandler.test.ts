import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { loadAgentRegistry } from '../src/agentRegistry';
import { executeAgent } from '../src/handlers/agentHandler';

jest.mock('child_process', () => ({
  spawnSync: jest.fn(),
}));

const mockSpawn = spawnSync as jest.MockedFunction<typeof spawnSync>;

const TMP = path.resolve(__dirname, 'tmp_handler');
beforeAll(() => { if (!fs.existsSync(TMP)) fs.mkdirSync(TMP); });
afterAll(() => { if (fs.existsSync(TMP)) fs.rmSync(TMP, { recursive: true }); });

function setupAgent(model?: string, frontmatterModel?: string) {
  const agentDir = path.join(TMP, '.raili');
  if (!fs.existsSync(agentDir)) {
    fs.mkdirSync(agentDir);
  }
  const agentFile = path.join(TMP, 'agents', 'analyzer.agent.md');
  fs.mkdirSync(path.dirname(agentFile), { recursive: true });
  const frontmatter = frontmatterModel ? `---\nmodel: ${frontmatterModel}\n---\n` : '';
  fs.writeFileSync(agentFile, `${frontmatter}Agent instructions here`);
  const entry: any = { path: './agents/analyzer.agent.md' };

  if (model) {
    entry.model = model;
  }
  const reg = { 'analyzer.agent': entry };
  fs.writeFileSync(path.join(agentDir, 'agent-registry.json'), JSON.stringify(reg));
  return loadAgentRegistry(TMP);
}

beforeEach(() => {
  mockSpawn.mockReturnValue({ status: 0, stdout: 'agent output', stderr: '', pid: 1, output: [], signal: null, error: undefined } as any);
});

test('runs copilot command without model when none specified', () => {
  const registry = setupAgent();
  executeAgent(registry, 'analyzer.agent', TMP);
  expect(mockSpawn).toHaveBeenCalledWith(
    'copilot',
    ['--agent=analyzer.agent', '--prompt', 'Work according to your rules', '--yolo'],
    expect.any(Object),
  );
});

test('uses model from agent frontmatter', () => {
  const registry = setupAgent(undefined, 'claude-sonnet-4.6');
  executeAgent(registry, 'analyzer.agent', TMP);
  expect(mockSpawn).toHaveBeenCalledWith(
    'copilot',
    ['--agent=analyzer.agent', '--model=claude-sonnet-4.6', '--prompt', 'Work according to your rules', '--yolo'],
    expect.any(Object),
  );
});

test('registry model overrides frontmatter model', () => {
  const registry = setupAgent('gpt-5.1', 'claude-sonnet-4.6');
  executeAgent(registry, 'analyzer.agent', TMP);
  expect(mockSpawn).toHaveBeenCalledWith(
    'copilot',
    ['--agent=analyzer.agent', '--model=gpt-5.1', '--prompt', 'Work according to your rules', '--yolo'],
    expect.any(Object),
  );
});

test('returns success and stdout on exit code 0', () => {
  const registry = setupAgent();
  const res = executeAgent(registry, 'analyzer.agent', TMP);
  expect(res.success).toBe(true);
  expect(res.output).toBe('agent output');
});

test('returns failure on non-zero exit code', () => {
  mockSpawn.mockReturnValueOnce({ status: 1, stdout: '', stderr: 'error occurred', pid: 1, output: [], signal: null, error: undefined } as any);
  const registry = setupAgent();
  const res = executeAgent(registry, 'analyzer.agent', TMP);
  expect(res.success).toBe(false);
  expect(res.output).toBe('error occurred');
});

test('throws when agent not in registry', () => {
  const registry = setupAgent();
  expect(() => executeAgent(registry, 'missing.agent', TMP)).toThrow("Agent 'missing.agent' not found in registry");
});
