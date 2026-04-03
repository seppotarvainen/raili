import {
  loadApprovalResolver,
  loadFeedbackResolver,
  executeApprovalResolver,
  executeFeedbackResolver,
  handleManualTransition,
  handleFeedbackPrompt,
} from '../../../src/handlers/manualHandler';

afterEach(() => {
  jest.restoreAllMocks();
  delete process.env.RAILI_MANUAL_CHOICE;
});

describe('resolver loaders', () => {
  test('loadApprovalResolver returns function when module exports function (fn export)', () => {
    jest.mock('approval-fn-mod', () => jest.fn(async () => 'PASSED'), { virtual: true });
    const fn = loadApprovalResolver('approval-fn-mod');
    expect(typeof fn).toBe('function');
  });

  test('loadApprovalResolver returns function when module exports default function', () => {
    jest.mock('approval-default-mod', () => ({ default: jest.fn(async () => 'FAILED') }), { virtual: true });
    const fn = loadApprovalResolver('approval-default-mod');
    expect(typeof fn).toBe('function');
  });

  test('loadApprovalResolver throws when exported value is not a function', () => {
    jest.mock('approval-bad-mod', () => ({ notFn: true }), { virtual: true });
    expect(() => loadApprovalResolver('approval-bad-mod')).toThrow(/does not export a function/);
  });

  test('loadFeedbackResolver returns function when module exports function', () => {
    jest.mock('feedback-fn-mod', () => jest.fn(async () => 'some feedback'), { virtual: true });
    const fn = loadFeedbackResolver('feedback-fn-mod');
    expect(typeof fn).toBe('function');
  });

  test('loadFeedbackResolver throws when exported value is not a function', () => {
    jest.mock('feedback-bad-mod', () => ({ default: 123 }), { virtual: true });
    expect(() => loadFeedbackResolver('feedback-bad-mod')).toThrow(/does not export a function/);
  });
});

describe('execute wrappers', () => {
  test('executeApprovalResolver returns outcome and validates value', async () => {
    const resolver = async () => 'PASSED';
    const out = await executeApprovalResolver(resolver as any, { question: 'q', stateName: 's' });
    expect(out).toBe('PASSED');
  });

  test('executeApprovalResolver throws when resolver throws', async () => {
    const resolver = async () => { throw new Error('boom'); };
    await expect(executeApprovalResolver(resolver as any, { question: 'q', stateName: 's' })).rejects.toThrow('boom');
  });

  test('executeApprovalResolver throws when resolver returns invalid value', async () => {
    const resolver = async () => ("INVALID" as any);
    await expect(executeApprovalResolver(resolver as any, { question: 'q', stateName: 's' })).rejects.toThrow(/invalid outcome/);
  });

  test('executeFeedbackResolver returns string', async () => {
    const resolver = async () => 'hello';
    const out = await executeFeedbackResolver(resolver as any, { prompt: 'p', stateName: 's' });
    expect(out).toBe('hello');
  });

  test('executeFeedbackResolver throws when resolver throws', async () => {
    const resolver = async () => { throw new Error('boom2'); };
    await expect(executeFeedbackResolver(resolver as any, { prompt: 'p', stateName: 's' })).rejects.toThrow('boom2');
  });

  test('executeFeedbackResolver throws when resolver returns non-string', async () => {
    const resolver = async () => (123 as any);
    await expect(executeFeedbackResolver(resolver as any, { prompt: 'p', stateName: 's' })).rejects.toThrow(/must return a string/);
  });
});

describe('handler integration with resolvers', () => {
  test('handleManualTransition uses provided approvalResolver and maps to target', async () => {
    const cfg = { question: 'Ok?', options: { PASSED: 'x', FAILED: 'y' } } as any;
    const resolver = async () => 'FAILED';
    const res = await handleManualTransition(cfg, resolver as any);
    expect(res.chosen).toBe('FAILED');
    expect(res.target).toBe('y');
    expect(res.waitMs).toBe(0);
  });

  test('handleFeedbackPrompt uses provided feedbackResolver', async () => {
    const feedback = { expose_var: 'note', question: 'Q' } as any;
    const resolver = async () => 'my feedback';
    const out = await handleFeedbackPrompt(feedback, resolver as any);
    expect(out).toBe('my feedback');
  });
});
