import { EventEmitter } from 'events';
import { spawn } from 'child_process';
import { executeCommand } from '../../../src/handlers/commandHandler';
import { CancellationController } from '../../../src/types';

jest.mock('child_process', () => ({ spawn: jest.fn() }));
const mockedSpawn = jest.mocked(spawn);

function fakeChild(stdout: string, stderr: string, exitCode: number) {
  const child = new EventEmitter() as any;
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  setImmediate(() => {
    if (stdout) child.stdout.emit('data', Buffer.from(stdout));
    if (stderr) child.stderr.emit('data', Buffer.from(stderr));
    child.emit('close', exitCode);
  });
  return child;
}

afterEach(() => {
  mockedSpawn.mockClear();
});

test('resolves success=true and captures stdout when exit code is 0', async () => {
  mockedSpawn.mockImplementation(() => fakeChild('hello output\n', '', 0));
  const result = await executeCommand('echo hello', '/tmp');
  expect(result.success).toBe(true);
  expect(result.stdout).toContain('hello output');
  expect(result.exitCode).toBe(0);
});

test('resolves success=false and captures stderr when exit code is non-zero', async () => {
  mockedSpawn.mockImplementation(() => fakeChild('', 'error occurred\n', 1));
  const result = await executeCommand('exit 1', '/tmp');
  expect(result.success).toBe(false);
  expect(result.stderr).toContain('error occurred');
  expect(result.exitCode).toBe(1);
});

test('spawns sh -c with the command string', async () => {
  mockedSpawn.mockImplementation(() => fakeChild('', '', 0));
  await executeCommand('ls -la', '/some/cwd');
  expect(mockedSpawn).toHaveBeenCalledWith('sh', ['-c', 'ls -la'], expect.objectContaining({ cwd: '/some/cwd' }));
});

test('merges envOverrides into process.env', async () => {
  mockedSpawn.mockImplementation(() => fakeChild('', '', 0));
  await executeCommand('printenv', '/tmp', { MY_VAR: 'hello' });
  const envPassed = mockedSpawn.mock.calls[0][2].env;
  expect(envPassed?.MY_VAR).toBe('hello');
});

test('handles null exit code (exitCode is undefined)', async () => {
  const child = new EventEmitter() as any;
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  setImmediate(() => child.emit('close', null));
  mockedSpawn.mockImplementation(() => child);
  const result = await executeCommand('cmd', '/tmp');
  expect(result.exitCode).toBeUndefined();
});

test('terminates an in-flight command and cancellation wins the close race', async () => {
  const child = Object.assign(new EventEmitter(), {
    stdout: new EventEmitter(),
    stderr: new EventEmitter(),
    kill() {},
  });
  const kill = jest.spyOn(child, 'kill');
  mockedSpawn.mockImplementationOnce(() => child as any);
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

  const resultPromise = executeCommand('sleep 1', '/tmp', {}, cancellation);
  cancellation.requestCancellation();
  child.emit('close', 1);
  child.emit('close', 0);

  await expect(resultPromise).resolves.toMatchObject({ success: false, cancelled: true });
  expect(kill).toHaveBeenCalledTimes(1);
});
