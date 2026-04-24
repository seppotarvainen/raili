import { rollbackHistory } from '../../../src/context/context';
import { WorkflowContext, StateHistoryEntry } from '../../../src/types';

describe('rollbackHistory', () => {
  const baseHistory: StateHistoryEntry[] = [
    { state: 'a', enteredAt: 't1', meta: {} },
    { state: 'b', enteredAt: 't2', meta: {} },
    { state: 'c', enteredAt: 't3', meta: {} },
    { state: 'b', enteredAt: 't4', meta: {} },
  ];

  function makeCtx(): WorkflowContext {
    return { vars: { ticket: '123' }, approvals: {}, feedbacks: {}, stateHistory: [...baseHistory] } as WorkflowContext;
  }

  test('numeric rollback removes last N entries', () => {
    const ctx = makeCtx();
    const res = rollbackHistory(ctx, '2');
    expect(res).not.toBe(ctx);
    expect(res.stateHistory.map((e) => e.state)).toEqual(['a', 'b']);
    expect(res.vars).toEqual(ctx.vars);
  });

  test('state-id rollback truncates to last occurrence', () => {
    const ctx = makeCtx();
    const res = rollbackHistory(ctx, 'c');
    expect(res.stateHistory.map((e) => e.state)).toEqual(['a', 'b', 'c']);
    expect(res.vars).toEqual(ctx.vars);
  });

  test('numeric rollback errors when N > length', () => {
    const ctx = makeCtx();
    expect(() => rollbackHistory(ctx, '10')).toThrowError('Cannot rollback 10 steps: history only has 4 entries');
  });

  test('state-id rollback errors when not found', () => {
    const ctx = makeCtx();
    expect(() => rollbackHistory(ctx, 'z')).toThrowError("State 'z' not found in history");
  });

  test('zero rollback returns same history value but new context object', () => {
    const ctx = makeCtx();
    const res = rollbackHistory(ctx, '0');
    expect(res.stateHistory).toEqual(ctx.stateHistory);
    expect(res).not.toBe(ctx);
  });
});
