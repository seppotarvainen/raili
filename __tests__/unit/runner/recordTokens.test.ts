import { addStateToHistory } from '../../../src/context/context';
import { WorkflowContext } from '../../../src/types';

describe('addStateToHistory token merging', () => {
  test('replaces existing meta.tokens with provided TokenUsage', () => {
    const ctx: WorkflowContext = {
      vars: {},
      approvals: {},
      feedbacks: {},
      stateHistory: [
        {
          state: 'analyze',
          enteredAt: 't1',
          meta: { tokens: { input: 1, output: 2 } },
        },
      ],
    };

    const newTokens = { input: 10, output: 20 };
    const res = addStateToHistory(ctx, 'analyze', { tokens: newTokens });

    expect(res).not.toBe(ctx);
    const last = res.stateHistory[res.stateHistory.length - 1];
    expect(last.meta).toBeDefined();
    expect((last.meta as any).tokens).toEqual(newTokens);
  });
});
