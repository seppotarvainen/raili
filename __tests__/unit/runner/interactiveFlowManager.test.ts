import { InteractiveFlowManager } from '../../../src/runner/interactiveFlowManager';
import { runApprovalStep } from '../../../src/runner/approveStateRunner';
import { handleFeedbackPrompt } from '../../../src/handlers/manualHandler';
import { Presenter } from '../../../src/presenter';

jest.mock('../../../src/runner/approveStateRunner');
jest.mock('../../../src/handlers/manualHandler');

const mockRunApproval = runApprovalStep as jest.MockedFunction<typeof runApprovalStep>;
const mockHandleFeedback = handleFeedbackPrompt as jest.MockedFunction<typeof handleFeedbackPrompt>;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('InteractiveFlowManager', () => {
  test('handleApproval records decision and returns next state', async () => {
    const ctx: any = { stateHistory: [], vars: {}, approvals: {} };
    const record = jest.fn().mockReturnValue(true);
    const persist = jest.fn();

    mockRunApproval.mockResolvedValue({
      chosen: 'PASSED',
      target: 'ok',
      reason: '',
      question: 'Is it ok?',
    } as any);

    const mgr = new InteractiveFlowManager({
      cwd: '/tmp',
      workflowArg: undefined,
      approvalResolverPath: undefined,
      feedbackResolverPath: undefined,
      ctxApi: { record, persist, context: () => ctx },
    });

    const stateDef: any = { config: { approval: { PASSED: 'ok', FAILED: 'err' } } };

    const presenter = new Presenter();
    presenter.appendStateEnter({ id: 'mystate', config: { type: 'agent' } } as any, 1, 1, new Date().toISOString());

    const next = await mgr.handleApproval('mystate', stateDef, presenter);

    expect(next).toBe('ok');
    expect(record).toHaveBeenCalled();
    expect(ctx.vars['MYSTATE_PASSED']).toBe('');
  });

  test('handleApproval records waitMs when present in outcome', async () => {
    const ctx: any = { stateHistory: [], vars: {}, approvals: {} };
    const record = jest.fn().mockReturnValue(true);

    mockRunApproval.mockResolvedValue({
      chosen: 'FAILED',
      target: 'err',
      reason: 'no',
      question: 'Why?',
      waitMs: 1500,
    } as any);

    const mgr = new InteractiveFlowManager({
      cwd: '/tmp',
      workflowArg: undefined,
      approvalResolverPath: undefined,
      feedbackResolverPath: undefined,
      ctxApi: { record, context: () => ctx },
    });

    const stateDef: any = { config: { approval: { PASSED: 'ok', FAILED: 'err' } } };

    const next = await mgr.handleApproval('mystate', stateDef);

    expect(next).toBe('err');
    // record should have been called with meta containing approval and waitMs
    const metaArg = (record.mock.calls[0] as any)[1];
    expect(metaArg).toHaveProperty('approval');
    expect(metaArg.waitMs).toBe(1500);
  });

  test('handleFeedback handles null (timeout) and returns null when no transitions', async () => {
    const ctx: any = { stateHistory: [], vars: {} };
    const record = jest.fn().mockReturnValue(true);
    const persist = jest.fn();

    mockHandleFeedback.mockResolvedValue(null as any);

    const mgr = new InteractiveFlowManager({
      cwd: '/tmp',
      workflowArg: undefined,
      approvalResolverPath: undefined,
      feedbackResolverPath: undefined,
      ctxApi: { record, persist, context: () => ctx },
    });

    const stateDef: any = { config: { feedback: { expose_var: 'fb' } } };

    const next = await mgr.handleFeedback('s1', stateDef);

    expect(next).toBeNull();
    expect(ctx.vars.fb).toBe('');
    expect(ctx.feedbacks['s1'].value).toBe('');
  });

  test('handleFeedback stores metadata when resolver returns object', async () => {
    const ctx: any = { stateHistory: [], vars: {} };
    const record = jest.fn().mockReturnValue(true);

    mockHandleFeedback.mockResolvedValue({ feedback: 'ok', metadata: 'meta-1' } as any);

    const mgr = new InteractiveFlowManager({
      cwd: '/tmp',
      workflowArg: undefined,
      approvalResolverPath: undefined,
      feedbackResolverPath: undefined,
      ctxApi: { record, context: () => ctx },
    });

    const stateDef: any = { config: { feedback: { expose_var: 'fb' } } };

    const next = await mgr.handleFeedback('s1', stateDef);

    expect(next).toBeNull();
    expect(ctx.vars.fb).toBe('ok');
    expect(ctx.feedbacks['s1'].metadata).toBe('meta-1');
  });
});
