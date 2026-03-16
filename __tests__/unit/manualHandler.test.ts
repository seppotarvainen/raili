import { handleManualTransition } from '../../src/handlers/manualHandler';

afterEach(() => { delete process.env.RAILI_MANUAL_CHOICE; });

test('uses PASSED env override', async () => {
  process.env.RAILI_MANUAL_CHOICE = 'PASSED';
  const cfg = { question: 'Okay?', options: { PASSED: 'execute', FAILED: 'analyze' } };
  const res = await handleManualTransition(cfg);
  expect(res.chosen).toBe('PASSED');
  expect(res.target).toBe('execute');
  expect(res.reason).toBe('');
});

test('uses FAILED env override', async () => {
  process.env.RAILI_MANUAL_CHOICE = 'FAILED';
  const cfg = { question: 'Okay?', options: { PASSED: 'execute', FAILED: 'analyze' } };
  const res = await handleManualTransition(cfg);
  expect(res.chosen).toBe('FAILED');
  expect(res.target).toBe('analyze');
});

test('throws if no options provided', async () => {
  process.env.RAILI_MANUAL_CHOICE = 'PASSED';
  await expect(handleManualTransition({ question: 'Okay?', options: {} })).rejects.toThrow('No manual options provided');
});

test('empty input (Enter) resolves to PASSED', async () => {
  const cfg = { question: 'Okay?', options: { PASSED: 'execute', FAILED: 'analyze' } };
  const { PassThrough } = require('stream');
  const mockStdin = new PassThrough();
  jest.spyOn(process, 'stdin', 'get').mockReturnValue(mockStdin as any);
  const promise = handleManualTransition(cfg);
  mockStdin.emit('data', '\n');
  const res = await promise;
  expect(res.chosen).toBe('PASSED');
  expect(res.reason).toBe('');
  jest.restoreAllMocks();
});

test('typed text resolves to FAILED with reason', async () => {
  const cfg = { question: 'Okay?', options: { PASSED: 'execute', FAILED: 'analyze' } };
  const { PassThrough } = require('stream');
  const mockStdin = new PassThrough();
  jest.spyOn(process, 'stdin', 'get').mockReturnValue(mockStdin as any);
  const promise = handleManualTransition(cfg);
  mockStdin.emit('data', 'wrong approach\n');
  const res = await promise;
  expect(res.chosen).toBe('FAILED');
  expect(res.reason).toBe('wrong approach');
  expect(res.target).toBe('analyze');
  jest.restoreAllMocks();
});
