import { runNotify } from '../../../src/handlers/notifyHandler';
import * as commandHandler from '../../../src/handlers/commandHandler';

jest.mock('../../../src/handlers/commandHandler');
const mockExecuteCommand = commandHandler.executeCommand as jest.MockedFunction<typeof commandHandler.executeCommand>;

afterEach(() => {
  jest.resetAllMocks();
});

test('returns success result when command exits 0', async () => {
  mockExecuteCommand.mockResolvedValue({ success: true, stdout: '', stderr: '', exitCode: 0 });
  const result = await runNotify('echo done', '/tmp');
  expect(result?.success).toBe(true);
  expect(result?.command).toBe('echo done');
  expect(result?.stderr).toBeUndefined(); // empty stderr → undefined
});

test('logs warning and returns failure when command exits non-zero', async () => {
  mockExecuteCommand.mockResolvedValue({ success: false, stdout: '', stderr: 'oops', exitCode: 1 });
  const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
  const result = await runNotify('bad-cmd', '/tmp');
  expect(result?.success).toBe(false);
  expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('non-fatal'));
  expect(result?.stderr).toBe('oops'); // non-empty stderr is passed through
});

test('exposes vars as RAILI_VAR_* in env overrides', async () => {
  mockExecuteCommand.mockResolvedValue({ success: true, stdout: '', stderr: '', exitCode: 0 });
  await runNotify('cmd', '/tmp', { ticket_id: 'T-1', branch: 'main' });
  expect(mockExecuteCommand).toHaveBeenCalledWith(
    'cmd',
    '/tmp',
    expect.objectContaining({ RAILI_VAR_TICKET_ID: 'T-1', RAILI_VAR_BRANCH: 'main' }),
  );
});

