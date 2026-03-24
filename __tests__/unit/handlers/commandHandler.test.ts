import { EventEmitter } from 'events';
import { executeCommand } from '../../../src/handlers/commandHandler';

jest.mock('child_process', () => ({ spawn: jest.fn() }));
const { spawn } = require('child_process');

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
  spawn.mockReset();
});

test('resolves success=true and captures stdout when exit code is 0', async () => {
  spawn.mockImplementation(() => fakeChild('hello output\n', '', 0));
  const result = await executeCommand('echo hello', '/tmp');
  expect(result.success).toBe(true);
  expect(result.stdout).toContain('hello output');
  expect(result.exitCode).toBe(0);
});

test('resolves success=false and captures stderr when exit code is non-zero', async () => {
  spawn.mockImplementation(() => fakeChild('', 'error occurred\n', 1));
  const result = await executeCommand('exit 1', '/tmp');
  expect(result.success).toBe(false);
  expect(result.stderr).toContain('error occurred');
  expect(result.exitCode).toBe(1);
});

test('spawns sh -c with the command string', async () => {
  spawn.mockImplementation(() => fakeChild('', '', 0));
  await executeCommand('ls -la', '/some/cwd');
  expect(spawn).toHaveBeenCalledWith('sh', ['-c', 'ls -la'], expect.objectContaining({ cwd: '/some/cwd' }));
});

test('merges envOverrides into process.env', async () => {
  spawn.mockImplementation(() => fakeChild('', '', 0));
  await executeCommand('printenv', '/tmp', { MY_VAR: 'hello' });
  const envPassed = spawn.mock.calls[0][2].env;
  expect(envPassed.MY_VAR).toBe('hello');
});

test('handles null exit code (exitCode is undefined)', async () => {
  const child = new EventEmitter() as any;
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  setImmediate(() => child.emit('close', null));
  spawn.mockImplementation(() => child);
  const result = await executeCommand('cmd', '/tmp');
  expect(result.exitCode).toBeUndefined();
});

