import path from 'path';
import {EventEmitter} from 'events';
import { spawn } from 'child_process';
import {loadAgentRegistry} from '../../../src/registry/agentRegistry';
import {executeAgent} from '../../../src/handlers/agentHandler';
import { setupFakeFs } from '../infrastructure/fsFake.util';
import { getFileSystem } from '../../../src/infrastructure/fileSystemProvider';
import { CancellationController } from '../../../src/types';

jest.mock('child_process', () => ({ spawn: jest.fn() }));
const mockedSpawn = jest.mocked(spawn);

const TMP = '/tmp';
const isWindows = process.platform === 'win32';
const copilotCommand = isWindows ? process.env.ComSpec ?? 'cmd.exe' : 'copilot';

function expectedSpawnArgs(args: string[]): string[] {
  if (!isWindows) return args;

  const quote = (value: string) =>
    `"${value.replace(/(\\*)"/g, '$1$1\\"').replace(/(\\+)$/g, '$1$1')}"`;
  return ['/d', '/s', '/c', ['copilot.cmd', ...args.map(quote)].join(' ')];
}

let restoreFs: () => void;

beforeEach(() => { restoreFs = setupFakeFs(); });

afterEach(() => { restoreFs(); });

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

function fakeErrorChild(error: NodeJS.ErrnoException) {
  const child = new EventEmitter() as any;
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  setImmediate(() => child.emit('error', error));
  return child;
}

function setupAgent(model?: string, frontmatterModel?: string) {
  const fs = getFileSystem();
  const agentDir = path.join(TMP, '.raili');
  if (!fs.existsSync(agentDir)) fs.mkdirSync(agentDir, { recursive: true } as any);
  // Create .raili/main/outputs/ so resolveWorkflowDir succeeds when readLatestNRuns is called
  fs.mkdirSync(path.join(agentDir, 'main', 'outputs'), { recursive: true } as any);
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
  mockedSpawn.mockClear();
  mockedSpawn.mockImplementation(() => fakeChild('agent output', '', 0));
});

test('runs copilot command without model when none specified', async () => {
  const registry = setupAgent();
  await executeAgent(registry, 'analyzer.agent', TMP);
  expect(mockedSpawn).toHaveBeenCalledWith(
    copilotCommand,
    expectedSpawnArgs(['--agent=analyzer.agent', '--prompt', 'Work according to your rules', '--yolo']),
    expect.any(Object),
  );
});

test('uses model from agent frontmatter', async () => {
  const registry = setupAgent(undefined, 'claude-sonnet-4.6');
  await executeAgent(registry, 'analyzer.agent', TMP);
  expect(mockedSpawn).toHaveBeenCalledWith(
    copilotCommand,
    expectedSpawnArgs(['--agent=analyzer.agent', '--model=claude-sonnet-4.6', '--prompt', 'Work according to your rules', '--yolo']),
    expect.any(Object),
  );
});

test('registry model overrides frontmatter model', async () => {
  const registry = setupAgent('gpt-5.1', 'claude-sonnet-4.6');
  await executeAgent(registry, 'analyzer.agent', TMP);
  expect(mockedSpawn).toHaveBeenCalledWith(
    copilotCommand,
    expectedSpawnArgs(['--agent=analyzer.agent', '--model=gpt-5.1', '--prompt', 'Work according to your rules', '--yolo']),
    expect.any(Object),
  );
});

test('returns success and stdout on exit code 0', async () => {
  const registry = setupAgent();
  const res = await executeAgent(registry, 'analyzer.agent', TMP);
  expect(res.success).toBe(true);
  expect(res.stdout).toBe('agent output');
});

test('returns failure on non-zero exit code', async () => {
  mockedSpawn.mockImplementationOnce(() => fakeChild('', 'error occurred', 1));
  const registry = setupAgent();
  const res = await executeAgent(registry, 'analyzer.agent', TMP);
  expect(res.success).toBe(false);
  expect(res.stderr).toContain('error occurred');
});

test('throws when agent not in registry', () => {
  const registry = setupAgent();
  expect(() => executeAgent(registry, 'missing.agent', TMP)).toThrow("Agent 'missing.agent' not found in registry");
});

test('uses default prompt when no previousOutputPath given', async () => {
  const registry = setupAgent();
  await executeAgent(registry, 'analyzer.agent', TMP);
  expect(mockedSpawn).toHaveBeenCalledWith(
    copilotCommand,
    expectedSpawnArgs(['--agent=analyzer.agent', '--prompt', 'Work according to your rules', '--yolo']),
    expect.any(Object),
  );
});

test('injects previous output content into prompt when previousOutputPath is provided', async () => {
  const registry = setupAgent();
  const prevFile = path.join(TMP, '.raili', 'main', 'outputs', 'previous.md');
  getFileSystem().writeFileSync(prevFile, 'I already did X');

  await executeAgent(registry, 'analyzer.agent', TMP, prevFile);

  const spawnArgs = mockedSpawn.mock.calls[0][1] as string[];
  const promptIndex = spawnArgs.indexOf('--prompt');
  const prompt = spawnArgs[promptIndex + 1];
  expect(prompt).toContain('Work according to your rules');
  expect(prompt).toContain('I already did X');
});

test('uses default prompt when previousOutputPath is null', async () => {
  const registry = setupAgent();
  await executeAgent(registry, 'analyzer.agent', TMP, null);
  expect(mockedSpawn).toHaveBeenCalledWith(
    copilotCommand,
    expectedSpawnArgs(['--agent=analyzer.agent', '--prompt', 'Work according to your rules', '--yolo']),
    expect.any(Object),
  );
});

test('uses default prompt when previousOutputPath points to nonexistent file', async () => {
  const registry = setupAgent();
  await executeAgent(registry, 'analyzer.agent', TMP, '/nonexistent/path.md');
  expect(mockedSpawn).toHaveBeenCalledWith(
    copilotCommand,
    expectedSpawnArgs(['--agent=analyzer.agent', '--prompt', 'Work according to your rules', '--yolo']),
    expect.any(Object),
  );
});

test('injects all runs when history file has multiple runs (default behavior)', async () => {
  const registry = setupAgent();
  const historyFile = path.join(TMP, '.raili', 'main', 'outputs', 'history.md');
  getFileSystem().writeFileSync(
    historyFile,
    'first run output\n\n--- Run 2026-01-01T00:00:00.000Z ---\n\nsecond run output\n\n--- Run 2026-02-01T00:00:00.000Z ---\n\nthird run output',
  );

  await executeAgent(registry, 'analyzer.agent', TMP, historyFile);

  const spawnArgs = mockedSpawn.mock.calls[0][1] as string[];
  const promptIndex = spawnArgs.indexOf('--prompt');
  const prompt = spawnArgs[promptIndex + 1];
  expect(prompt).toContain('first run output');
  expect(prompt).toContain('second run output');
  expect(prompt).toContain('third run output');
});

test('uses custom prompt when prompt param is provided', async () => {
  const registry = setupAgent();
  await executeAgent(registry, 'analyzer.agent', TMP, null, 'Analyze ticket $RAILI_VAR_TICKET_ID');

  const spawnArgs = mockedSpawn.mock.calls[0][1] as string[];
  const promptIndex = spawnArgs.indexOf('--prompt');
  expect(spawnArgs[promptIndex + 1]).toBe('Analyze ticket $RAILI_VAR_TICKET_ID');
});

test('appends previous output to custom prompt when both are provided', async () => {
  const registry = setupAgent();
  const prevFile = path.join(TMP, '.raili', 'main', 'outputs', 'prev_custom.md');
  getFileSystem().writeFileSync(prevFile, 'previous work');

  await executeAgent(registry, 'analyzer.agent', TMP, prevFile, 'Do the thing');

  const spawnArgs = mockedSpawn.mock.calls[0][1] as string[];
  const promptIndex = spawnArgs.indexOf('--prompt');
  const prompt = spawnArgs[promptIndex + 1];
  expect(prompt).toContain('Do the thing');
  expect(prompt).toContain('previous work');
});

test('spawn inherits process.env so RAILI_VAR_* set by run.ts are available', async () => {
  process.env.RAILI_VAR_TICKET_ID = 'PROJ-999';
  const registry = setupAgent();
  await executeAgent(registry, 'analyzer.agent', TMP);

  // env is not passed explicitly — child inherits process.env by default
  const spawnOptions = mockedSpawn.mock.calls[0][2] as any;
  expect(spawnOptions.env).toBeUndefined();
  expect(process.env.RAILI_VAR_TICKET_ID).toBe('PROJ-999');
  delete process.env.RAILI_VAR_TICKET_ID;
});

test('terminates an in-flight agent and returns cancelled', async () => {
  const child = Object.assign(new EventEmitter(), {
    stdout: new EventEmitter(),
    stderr: new EventEmitter(),
    kill() {},
  });
  const kill = jest.spyOn(child, 'kill');
  mockedSpawn.mockImplementationOnce(() => child as any);
  const registry = setupAgent();
  let cancellationRequested = false;
  let listener: (() => void) | undefined;
  const cancellation: CancellationController = {
    get isCancellationRequested() {
      return cancellationRequested;
    },
    onCancellationRequested: (callback) => {
      listener = callback;
      return () => {
        listener = undefined;
      };
    },
    requestCancellation: () => {
      cancellationRequested = true;
      listener?.();
    },
  };

  const resultPromise = executeAgent(registry, 'analyzer.agent', TMP, null, undefined, null, undefined, cancellation);
  cancellation.requestCancellation();
  child.emit('close', 1);

  await expect(resultPromise).resolves.toMatchObject({ success: false, cancelled: true });
  expect(kill).toHaveBeenCalledTimes(1);
});

test('rejects clearly when Copilot CLI cannot be launched', async () => {
  mockedSpawn.mockImplementationOnce(() =>
    fakeErrorChild(
      Object.assign(new Error('spawn copilot ENOENT'), { code: 'ENOENT' }),
    ),
  );
  const registry = setupAgent();

  await expect(executeAgent(registry, 'analyzer.agent', TMP)).rejects.toThrow(
    'Copilot CLI could not be launched',
  );
});
