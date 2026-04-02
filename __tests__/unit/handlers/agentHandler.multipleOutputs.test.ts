import path from 'path';
import {EventEmitter} from 'events';
import {loadAgentRegistry} from '../../../src/registry/agentRegistry';
import {executeAgent} from '../../../src/handlers/agentHandler';
import { setupFakeFs } from '../infrastructure/fsFake.util';
import { getFileSystem } from '../../../src/infrastructure/fileSystemProvider';

jest.mock('child_process', () => ({ spawn: jest.fn() }));
const { spawn } = require('child_process');

// Mock readLatestNRuns from outputStore
jest.mock('../../../src/context/outputStore', () => ({
  readLatestNRuns: jest.fn(),
}));
import { readLatestNRuns } from '../../../src/context/outputStore';

const TMP = '/tmp';
let restoreFs: () => void;

beforeEach(() => { restoreFs = setupFakeFs(); });
afterEach(() => { restoreFs(); });

/** Creates a fake child process that emits stdout/stderr data then closes */
function fakeChild(stdoutData: string, stderrData: string, exitCode: number) {
  const child = new EventEmitter() as any;
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  setImmediate(() => {
    if (stdoutData) child.stdout.emit('data', Buffer.from(stdoutData));
    if (stderrData) child.stderr.emit('data', Buffer.from(stderrData));
    child.emit('close', exitCode);
  });
  return child;
}

function setupAgent(model?: string, frontmatterModel?: string) {
  const fs = getFileSystem();
  const agentDir = path.join(TMP, '.raili');
  if (!fs.existsSync(agentDir)) fs.mkdirSync(agentDir, { recursive: true } as any);
  const agentFile = path.join(TMP, 'agents', 'analyzer.agent.md');
  fs.mkdirSync(path.dirname(agentFile), { recursive: true } as any);
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
  (readLatestNRuns as jest.Mock).mockClear();
});

test('injects all stored runs when useLatest is undefined', async () => {
  const registry = setupAgent();
  // Ensure the outputs file path exists under .raili so executeAgent will call readLatestNRuns
  const outputsDir = path.join(TMP, '.raili', 'main', 'outputs');
  const p = path.join(outputsDir, 'analyzer.md');
  const fs = getFileSystem();
  fs.mkdirSync(outputsDir, { recursive: true } as any);
  fs.writeFileSync(p, 'placeholder');

  (readLatestNRuns as jest.Mock).mockImplementation((cwdArg: string, stateId: string, n?: number) => {
    expect(cwdArg).toBe(TMP);
    expect(stateId).toBe('analyzer');
    expect(n).toBeUndefined();
    return 'first run output\n--- Run X ---\nsecond run output\n--- Run Y ---\nthird run output';
  });

  await executeAgent(registry, 'analyzer.agent', TMP, p, undefined, undefined);

  const spawnArgs = spawn.mock.calls[0][1] as string[];
  const promptIndex = spawnArgs.indexOf('--prompt');
  const prompt = spawnArgs[promptIndex + 1];
  expect(prompt).toContain('first run output');
  expect(prompt).toContain('second run output');
  expect(prompt).toContain('third run output');
});

test('injects only the latest N runs when useLatest is provided', async () => {
  const registry = setupAgent();
  const outputsDir = path.join(TMP, '.raili', 'main', 'outputs');
  const p = path.join(outputsDir, 'analyzer.md');
  const fs = getFileSystem();
  fs.mkdirSync(outputsDir, { recursive: true } as any);
  fs.writeFileSync(p, 'placeholder');

  (readLatestNRuns as jest.Mock).mockImplementation((cwdArg: string, stateId: string, n?: number) => {
    expect(cwdArg).toBe(TMP);
    expect(stateId).toBe('analyzer');
    expect(n).toBe(2);
    return 'second run output\n--- Run Y ---\nthird run output';
  });

  await executeAgent(registry, 'analyzer.agent', TMP, p, undefined, 2);

  const spawnArgs = spawn.mock.calls[0][1] as string[];
  const promptIndex = spawnArgs.indexOf('--prompt');
  const prompt = spawnArgs[promptIndex + 1];
  expect(prompt).toContain('second run output');
  expect(prompt).toContain('third run output');
  expect(prompt).not.toContain('first run output');
});
