import { handleManualTransition, handleFeedbackPrompt } from '../../../src/handlers/manualHandler';

describe('manualHandler timeouts', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
    // cleanup env
    delete process.env.RAILI_FEEDBACK_TEST;
    delete process.env.RAILI_MANUAL_CHOICE;
  });

  test('handleManualTransition times out when resolver hangs', async () => {
    const never = () => new Promise(() => {});
    const p = handleManualTransition(
      { question: 'q', options: { PASSED: 'a', FAILED: 'b' } },
      never as any,
      undefined,
      10,
    );
    // advance timers to trigger timeout
    jest.advanceTimersByTime(20);
    await expect(p).rejects.toThrow('Approval prompt timeout exceeded');
  });

  test('handleManualTransition returns when resolver resolves quickly', async () => {
    const fast = async () => 'PASSED';
    const res = await handleManualTransition(
      { question: 'q', options: { PASSED: 'a', FAILED: 'b' } },
      fast as any,
      undefined,
      1000,
    );
    expect(res.chosen).toBe('PASSED');
  });

  test('handleFeedbackPrompt times out when resolver hangs', async () => {
    const never = () => new Promise(() => {});
    const p = handleFeedbackPrompt(
      { expose_var: 'test' },
      never as any,
      10,
    );
    jest.advanceTimersByTime(20);
    await expect(p).rejects.toThrow('Feedback prompt timeout exceeded');
  });

  test('handleFeedbackPrompt returns env override immediately', async () => {
    process.env.RAILI_FEEDBACK_TEST = 'ok';
    const res = await handleFeedbackPrompt({ expose_var: 'test' });
    expect(res).toBe('ok');
  });
});

// Basic behavior tests (moved from __tests__/unit/manualHandler.test.ts)

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

// Multiline mode tests

test('multiline input collects lines until /q and returns FAILED with assembled reason', async () => {
  const cfg = { question: 'Explain?', options: { PASSED: 'ok', FAILED: 'needs' }, multiline: true };
  const { PassThrough } = require('stream');
  const mockStdin = new PassThrough();
  jest.spyOn(process, 'stdin', 'get').mockReturnValue(mockStdin as any);
  const promise = handleManualTransition(cfg);
  mockStdin.emit('data', 'first line\n');
  mockStdin.emit('data', 'second line\n');
  mockStdin.emit('data', '/q\n');
  const res = await promise;
  expect(res.chosen).toBe('FAILED');
  expect(res.reason).toBe('first line\nsecond line');
  expect(res.target).toBe('needs');
  jest.restoreAllMocks();
});

test('multiline immediate terminator /q results in PASSED with empty reason', async () => {
  const cfg = { question: 'Explain?', options: { PASSED: 'ok', FAILED: 'needs' }, multiline: true };
  const { PassThrough } = require('stream');
  const mockStdin = new PassThrough();
  jest.spyOn(process, 'stdin', 'get').mockReturnValue(mockStdin as any);
  const promise = handleManualTransition(cfg);
  mockStdin.emit('data', '/q\n');
  const res = await promise;
  expect(res.chosen).toBe('PASSED');
  expect(res.reason).toBe('');
  expect(res.target).toBe('ok');
  jest.restoreAllMocks();
});
