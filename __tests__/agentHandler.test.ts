import fs from 'fs';
import path from 'path';
import { EventEmitter } from 'events';
import { loadAgentRegistry } from '../src/agentRegistry';
import { executeAgent } from '../src/handlers/agentHandler';

jest.mock('child_process', () => ({ spawn: jest.fn() }));
const { spawn } = require('child_process');

const TMP = path.resolve(__dirname, 'tmp_handler');
beforeAll(() => { if (!fs.existsSync(TMP)) fs.mkdirSync(TMP); });
afterAll(() => { if (fs.existsSync(TMP)) fs.rmSync(TMP, { recursive: true }); });

/** Creates a fake child process that emits stdout/stderr data then closes */
function fakeChild(stdoutData: string, stderrData: string, exitCode: number) {
  const child = new EventEmitter() as any;
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  // Emit asynchronously so listeners are attached first
  setImmediate(() => {
    if (stdoutData) child.stdout.emit('data', Buffer.from(stdoutData));
    if (stderrData) child.stderr.emit('data', Buffer.from(stderrData));
    child.emit('close', exitCode);
  });
  return child;
}

function setupAgent(model?: string, frontmatterModel?: string) {
  const agentDir = path.join(TMP, '.raili');
  if (!fs.existsSync(agentDir)) fs.mkdirSync(agentDir);
  const agentFile = path.join(TMP, 'agents', 'analyzer.agent.md');
  fs.mkdirSync(path.dirname(agentFile), { recursive: true });
  const frontmatter = frontmatterModel ? `---\nmodel: ${frontmatterModel}\n---\n` : '';
  fs.writeFileSync(agentFile, `${frontmatter}Agent instructions here`);
  const entry: any = { path: './agents/analyzer.agent.md' };
  if (model) entry.model = model;
  const reg = { 'analyzer.agent': entry };
  fs.writeFileSync(path.join(agentDir, 'agent-registry.json'), JSON.stringify(reg));
  return loadAgentRegistry(TMP);
}

beforeEach(() => {
  spawn.mockClear();
  spawn.mockImplementation(() => fakeChild('agent output', '', 0));
});

test('runs copilot command without model when none specified', async () => {
  const registry = setupAgent();
  await executeAgent(registry, 'analyzer.agent', TMP);
  expect(spawn).toHaveBeenCalledWith(
    'copilot',
    ['--agent=analyzer.agent', '--prompt', 'Work according to your rules', '--yolo'],
    expect.any(Object),
  );
});

test('uses model from agent frontmatter', async () => {
  const registry = setupAgent(undefined, 'claude-sonnet-4.6');
  await executeAgent(registry, 'analyzer.agent', TMP);
  expect(spawn).toHaveBeenCalledWith(
    'copilot',
    ['--agent=analyzer.agent', '--model=claude-sonnet-4.6', '--prompt', 'Work according to your rules', '--yolo'],
    expect.any(Object),
  );
});

test('registry model overrides frontmatter model', async () => {
  const registry = setupAgent('gpt-5.1', 'claude-sonnet-4.6');
  await executeAgent(registry, 'analyzer.agent', TMP);
  expect(spawn).toHaveBeenCalledWith(
    'copilot',
    ['--agent=analyzer.agent', '--model=gpt-5.1', '--prompt', 'Work according to your rules', '--yolo'],
    expect.any(Object),
  );
});

test('returns success and stdout on exit code 0', async () => {
  const registry = setupAgent();
  const res = await executeAgent(registry, 'analyzer.agent', TMP);
  expect(res.success).toBe(true);
  expect(res.output).toBe('agent output');
});

test('returns failure on non-zero exit code', async () => {
  spawn.mockImplementationOnce(() => fakeChild('', 'error occurred', 1));
  const registry = setupAgent();
  const res = await executeAgent(registry, 'analyzer.agent', TMP);
  expect(res.success).toBe(false);
  expect(res.output).toBe('error occurred');
});

test('throws when agent not in registry', () => {
  const registry = setupAgent();
  expect(() => executeAgent(registry, 'missing.agent', TMP)).toThrow("Agent 'missing.agent' not found in registry");
});

test('uses default prompt when no previousOutputPath given', async () => {
  const registry = setupAgent();
  await executeAgent(registry, 'analyzer.agent', TMP);
  expect(spawn).toHaveBeenCalledWith(
    'copilot',
    expect.arrayContaining(['--prompt', 'Work according to your rules']),
    expect.any(Object),
  );
});

test('injects previous output content into prompt when previousOutputPath is provided', async () => {
  const registry = setupAgent();
  const prevFile = path.join(TMP, 'previous.md');
  fs.writeFileSync(prevFile, 'I already did X');

  await executeAgent(registry, 'analyzer.agent', TMP, prevFile);

  const spawnArgs = spawn.mock.calls[0][1] as string[];
  const promptIndex = spawnArgs.indexOf('--prompt');
  const prompt = spawnArgs[promptIndex + 1];
  expect(prompt).toContain('Work according to your rules');
  expect(prompt).toContain('I already did X');
});

test('uses default prompt when previousOutputPath is null', async () => {
  const registry = setupAgent();
  await executeAgent(registry, 'analyzer.agent', TMP, null);
  expect(spawn).toHaveBeenCalledWith(
    'copilot',
    expect.arrayContaining(['--prompt', 'Work according to your rules']),
    expect.any(Object),
  );
});

test('uses default prompt when previousOutputPath points to nonexistent file', async () => {
  const registry = setupAgent();
  await executeAgent(registry, 'analyzer.agent', TMP, '/nonexistent/path.md');
  expect(spawn).toHaveBeenCalledWith(
    'copilot',
    expect.arrayContaining(['--prompt', 'Work according to your rules']),
    expect.any(Object),
  );
});

