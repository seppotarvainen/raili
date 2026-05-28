import path from 'path';
import {EventEmitter} from 'events';
import {loadAgentRegistry} from '../../../src/registry/agentRegistry';
import {executeAgent} from '../../../src/handlers/agentHandler';
import { setupFakeFs } from '../infrastructure/fsFake.util';
import { getFileSystem } from '../../../src/infrastructure/fileSystemProvider';

jest.mock('child_process', () => ({ spawn: jest.fn() }));
const { spawn } = require('child_process');

const TMP = '/tmp';
let restoreFs: () => void;

beforeEach(() => { restoreFs = setupFakeFs(); });
afterEach(() => { restoreFs(); });

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

function setupAgent() {
  const fs = getFileSystem();
  const agentDir = path.join(TMP, '.raili');
  if (!fs.existsSync(agentDir)) fs.mkdirSync(agentDir, { recursive: true } as any);
  fs.mkdirSync(path.join(agentDir, 'main', 'outputs'), { recursive: true } as any);
  const agentFile = path.join(TMP, 'agents', 'analyzer.agent.md');
  fs.mkdirSync(path.dirname(agentFile), { recursive: true } as any);
  fs.writeFileSync(agentFile, 'Agent instructions here');
  const entry: any = { path: './agents/analyzer.agent.md' };
  const reg = { 'analyzer.agent': entry };
  fs.writeFileSync(path.join(agentDir, 'agent-registry.json'), JSON.stringify(reg));
  return loadAgentRegistry(TMP);
}

test('attaches tokens parsed from stdout to result', async () => {
  const registry = setupAgent();
  const tokenLine = 'Tokens     ↑ 256.9k (223.0k cached) • ↓ 9.7k';
  spawn.mockImplementationOnce(() => fakeChild(`some output\n${tokenLine}\nend`, '', 0));
  const res = await executeAgent(registry, 'analyzer.agent', TMP);
  expect(res.tokens).toBeDefined();
  expect(res.tokens!.input).toBe(256900);
  expect(res.tokens!.cached).toBe(223000);
  expect(res.tokens!.output).toBe(9700);
  expect(res.success).toBe(true);
  expect(res.stdout).toContain('some output');
});
