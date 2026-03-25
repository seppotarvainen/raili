import { addStateToHistory, initializeContext } from '../../../src/context/context';

describe('context flattened stateHistory', () => {
  test('addStateToHistory flattens and merges meta into existing entry', () => {
    let ctx = initializeContext({});
    ctx = addStateToHistory(ctx, 'group');
    ctx = addStateToHistory(ctx, 'group.sub');

    // Merge meta into the original 'group' entry
    ctx = addStateToHistory(ctx, 'group', { waitMs: 100 });

    expect(ctx.stateHistory.length).toBe(2);
    const first = ctx.stateHistory[0];
    expect(first.state).toBe('group');
    expect(first.meta).toBeDefined();
    expect(first.meta.waitMs).toBe(100);

    const second = ctx.stateHistory[1];
    expect(second.state).toBe('group.sub');
  });
});
