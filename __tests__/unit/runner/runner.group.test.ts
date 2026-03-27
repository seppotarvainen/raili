import { Runner } from '../../../src/runner/runner';
import { StateMachine } from '../../../src/types';

jest.mock('../../../src/context/context', () => ({
  loadContext: jest.fn(() => ({ stateHistory: [] })),
  addStateToHistory: jest.fn((ctx, state) => ({ ...ctx, stateHistory: [...(ctx.stateHistory || []), { state }] })),
  saveContext: jest.fn(),
}));

describe('Runner group dispatch', () => {
  it('throws when encountering unflattened group state', async () => {
    const machine: StateMachine = {
      initial: 'g',
      states: {
        g: { id: 'g', config: { type: 'group', group: 'sub.yaml', transitions: { PASSED: 'done' } }, transitions: ['done'] } as any,
        done: { id: 'done', config: { type: 'engine' }, transitions: [] } as any,
      },
    } as any;

    const runner = new Runner({
      stateMachine: machine as any,
      agentRegistry: {} as any,
      scriptRegistry: {} as any,
      context: { stateHistory: [] } as any,
      cwd: process.cwd(),
    });

    await expect(runner.run()).rejects.toThrow('groups must be flattened before execution');
  });
});
