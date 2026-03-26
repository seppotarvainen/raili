import {Runner} from '../../../src/runner/runner';
import {StateMachine} from '../../../src/types';
import * as approveRunner from '../../../src/runner/approveStateRunner';
import * as contextModule from '../../../src/context/context';

describe('Engine approval persistence', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it('persists failed approval reason into approvals map and vars', async () => {
    const approvalOutcome = {
      chosen: 'FAILED',
      target: 'rework',
      reason: 'not ready',
      question: 'Q',
      notify: undefined,
    } as any;

    jest.spyOn(approveRunner, 'runApprovalStep').mockResolvedValue(approvalOutcome);

    const savedContexts: any[] = [];
    jest.spyOn(contextModule, 'saveContext').mockImplementation((cwd: string, ctx: any) => {
      savedContexts.push(ctx);
    });

    const sm: StateMachine = {
      initial: 'review',
      states: {
        review: {
          id: 'review',
          config: {
            type: 'engine',
            approval: {
              question: 'Q',
              PASSED: 'done',
              FAILED: 'rework',
            },
          },
          transitions: [],
        },
        done: { id: 'done', config: { type: 'engine' }, transitions: [] },
        rework: { id: 'rework', config: { type: 'engine' }, transitions: [] },
      } as any,
    } as any;

    const runner = new Runner({
      stateMachine: sm,
      agentRegistry: {} as any,
      scriptRegistry: {} as any,
      context: { stateHistory: [] } as any,
      cwd: '/tmp',
    });

    await runner.run();

    const lastCtx = savedContexts[savedContexts.length - 1];
    expect(lastCtx).toBeDefined();
    expect(lastCtx.approvals).toBeDefined();
    expect(lastCtx.approvals['REVIEW_FAILED']).toBe('not ready');
    expect(lastCtx.vars['REVIEW_FAILED']).toBe('not ready');
  });
});
