import { StateExecutionManager } from '../../../src/runner/stateExecutionManager';
import { StateDef, WorkflowContext } from '../../../src/types';

describe('StateExecutionManager extra', () => {
  const cwd = '/tmp';
  const workflowArg = undefined;

  test('engine type returns PASSED without calling runners', async () => {
    const mockAgent = jest.fn();
    const mockScript = jest.fn();
    const mockCommand = jest.fn();

    const mgr = new StateExecutionManager({
      agentStateRunner: mockAgent as any,
      scriptStateRunner: mockScript as any,
      commandStateRunner: mockCommand as any,
      cwd,
      workflowArg,
    });

    const stateDef: StateDef = { id: 'e', config: { type: 'engine' as const }, transitions: [] };
    const ctx: WorkflowContext = { stateHistory: [] } as any;

    const res = await mgr.executeAndExport('e', stateDef, ctx);
    expect(res.outcome).toBe('PASSED');
    expect(mockAgent).not.toHaveBeenCalled();
    expect(mockScript).not.toHaveBeenCalled();
    expect(mockCommand).not.toHaveBeenCalled();
  });

  test('dispatches to script and merges exports', async () => {
    const mockAgent = jest.fn().mockResolvedValue({ outcome: 'PASSED' });
    const mockScript = jest.fn().mockResolvedValue({ outcome: 'FAILED', exports: { BAR: 'baz' } });
    const mockCommand = jest.fn();

    const mgr = new StateExecutionManager({
      agentStateRunner: mockAgent as any,
      scriptStateRunner: mockScript as any,
      commandStateRunner: mockCommand as any,
      cwd,
      workflowArg,
    });

    const stateDef: StateDef = { id: 's', config: { type: 'script' as const }, transitions: [] } as any;
    const ctx: WorkflowContext = { stateHistory: [] } as any;

    const res = await mgr.executeAndExport('s', stateDef, ctx);
    expect(res.outcome).toBe('FAILED');
    expect(ctx.vars).toBeDefined();
    expect(ctx.vars!['BAR']).toBe('baz');
    expect(mockScript).toHaveBeenCalled();
  });
});
