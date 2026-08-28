import path from 'path';
import {EventEmitter} from 'events';
import { spawn } from 'child_process';
import {loadScriptRegistry} from '../../../src/registry/scriptRegistry';
import {executeScript} from '../../../src/handlers/scriptHandler';
import { setupFakeFs } from '../infrastructure/fsFake.util';
import { getFileSystem } from '../../../src/infrastructure/fileSystemProvider';
import { CancellationController } from '../../../src/types';

jest.mock('child_process', () => ({ spawn: jest.fn() }));
const mockedSpawn = jest.mocked(spawn);

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

function setupRegistry() {
  const fs = getFileSystem();
  const raidir = path.join(TMP, '.raili');
  if (!fs.existsSync(raidir)) fs.mkdirSync(raidir, { recursive: true } as any);
  const scriptFile = path.join(TMP, 'scripts', 'archive.sh');
  fs.mkdirSync(path.dirname(scriptFile), { recursive: true } as any);
  fs.writeFileSync(scriptFile, 'echo hello');
  fs.chmodSync(scriptFile, 0o755);
  const reg = { 'archive-part': { path: './scripts/archive.sh' } };
  fs.writeFileSync(path.join(raidir, 'script-registry.json'), JSON.stringify(reg));
  return loadScriptRegistry(TMP);
}

function setupRuntimeRegistry(runtime: string = 'node') {
  const fs = getFileSystem();
  const raidir = path.join(TMP, '.raili');
  if (!fs.existsSync(raidir)) fs.mkdirSync(raidir, { recursive: true } as any);
  const scriptFile = path.join(TMP, 'scripts', 'example.js');
  fs.mkdirSync(path.dirname(scriptFile), { recursive: true } as any);
  fs.writeFileSync(scriptFile, 'console.log("hello")');
  fs.writeFileSync(
    path.join(raidir, 'script-registry.json'),
    JSON.stringify({ example: { path: './scripts/example.js', runtime } }),
  );
  return loadScriptRegistry(TMP);
}

beforeEach(() => {
  mockedSpawn.mockImplementation(() => fakeChild('hello\n', '', 0));
});

test('executeScript returns stdout on success', async () => {
  const loaded = setupRegistry();
  const res = await executeScript(loaded, 'archive-part', TMP);
  expect(res.success).toBe(true);
  expect(res.stdout.trim()).toBe('hello');
});

test('executeScript returns failure on non-zero exit', async () => {
  mockedSpawn.mockImplementationOnce(() => fakeChild('', 'error msg\n', 1));
  const loaded = setupRegistry();
  const res = await executeScript(loaded, 'archive-part', TMP);
  expect(res.success).toBe(false);
  expect(res.stderr).toContain('error msg');
});

test('executeScript throws when script not in registry', () => {
  const loaded = setupRegistry();
  expect(() => executeScript(loaded, 'missing-script', TMP)).toThrow("Script 'missing-script' not found in registry");
});

test('passes args to spawn when provided', async () => {
  const loaded = setupRegistry();
  await executeScript(loaded, 'archive-part', TMP, ['one', '--flag']);
  const fullPath = path.resolve(TMP, './scripts/archive.sh');
  expect(mockedSpawn).toHaveBeenCalledWith(fullPath, ['one', '--flag'], expect.any(Object));
});

test('runs a script through its configured runtime', async () => {
  const loaded = setupRuntimeRegistry();
  await executeScript(loaded, 'example', TMP, ['one', '--flag']);
  const fullPath = path.resolve(TMP, './scripts/example.js');
  expect(mockedSpawn).toHaveBeenCalledWith('node', [fullPath, 'one', '--flag'], expect.any(Object));
});

test('terminates an in-flight script and cancellation wins the close race', async () => {
  const child = Object.assign(new EventEmitter(), {
    stdout: new EventEmitter(),
    stderr: new EventEmitter(),
    kill() {},
  });
  const kill = jest.spyOn(child, 'kill');
  mockedSpawn.mockImplementationOnce(() => child as any);
  const loaded = setupRegistry();
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

  const resultPromise = executeScript(loaded, 'archive-part', TMP, [], {}, cancellation);
  cancellation.requestCancellation();
  child.emit('close', 0);
  child.emit('close', 1);

  await expect(resultPromise).resolves.toMatchObject({ success: false, cancelled: true });
  expect(kill).toHaveBeenCalledTimes(1);
});
