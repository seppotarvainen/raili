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
  test('executeApprovalResolver accepts object result with reason', async () => {
    const resolver = async () => ({ outcome: 'FAILED', reason: 'Missing tests' });
    const out = await executeApprovalResolver(resolver as any, { question: 'q', stateName: 's' });
    expect(out.outcome).toBe('FAILED');
    expect(out.reason).toBe('Missing tests');
  });

  test('executeApprovalResolver accepts legacy string result', async () => {
    const resolver = async () => 'PASSED';
    const out = await executeApprovalResolver(resolver as any, { question: 'q', stateName: 's' });
    expect(out.outcome).toBe('PASSED');
    expect(out.reason).toBeUndefined();
  });

  test('executeApprovalResolver throws when resolver throws', async () => {
    const resolver = async () => { throw new Error('boom'); };
    await expect(executeApprovalResolver(resolver as any, { question: 'q', stateName: 's' })).rejects.toThrow('boom');
  });

  test('executeApprovalResolver throws when resolver returns invalid value', async () => {
    const resolver = async () => ("INVALID" as any);
    await expect(executeApprovalResolver(resolver as any, { question: 'q', stateName: 's' })).rejects.toThrow(/invalid outcome/);
  });

  test('executeFeedbackResolver accepts object or string and returns structured result', async () => {
    const resolverObj = async () => ({ feedback: 'Looks good', metadata: 'auto' });
    const outObj = await executeFeedbackResolver(resolverObj as any, { prompt: 'p', stateName: 's' });
    expect(outObj).not.toBeNull();
    expect((outObj as any).feedback).toBe('Looks good');
    expect((outObj as any).metadata).toBe('auto');

    const resolverStr = async () => 'hello';
    const outStr = await executeFeedbackResolver(resolverStr as any, { prompt: 'p', stateName: 's' });
    expect(outStr).not.toBeNull();
    expect((outStr as any).feedback).toBe('hello');
  });

  test('executeFeedbackResolver throws when resolver throws', async () => {
    const resolver = async () => { throw new Error('boom2'); };
    await expect(executeFeedbackResolver(resolver as any, { prompt: 'p', stateName: 's' })).rejects.toThrow('boom2');
  });

  test('executeFeedbackResolver throws when resolver returns non-string/non-object', async () => {
    const resolver = async () => (123 as any);
    await expect(executeFeedbackResolver(resolver as any, { prompt: 'p', stateName: 's' })).rejects.toThrow(/must return a string or object/);
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
