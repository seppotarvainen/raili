import { StateExecutionManager } from '../../../src/runner/stateExecutionManager';
import { CancellationToken, StateDef, WorkflowContext } from '../../../src/types';

describe('StateExecutionManager', () => {
  const cwd = '/tmp';
  const workflowArg = undefined;

  test('dispatches to agent runner and merges exports into context', async () => {
    const mockAgent = jest.fn().mockResolvedValue({ outcome: 'PASSED', exports: { FOO: 'bar' } });
    const mockScript = jest.fn();
    const mockCommand = jest.fn();

    const mgr = new StateExecutionManager({
      agentStateRunner: mockAgent as any,
      scriptStateRunner: mockScript as any,
      commandStateRunner: mockCommand as any,
      cwd,
      workflowArg,
    });

    const stateDef: StateDef = { id: 's', config: { type: 'agent' as const }, transitions: [] };
    const ctx: WorkflowContext = { stateHistory: [] };

    const res = await mgr.executeAndExport('s', stateDef, ctx);
    expect(res.outcome).toBe('PASSED');
    expect(ctx.vars).toBeDefined();
    expect(ctx.vars!['FOO']).toBe('bar');
    expect(mockAgent).toHaveBeenCalled();
  });

  test('throws when declared expose missing and not optional', async () => {
    const mockAgent = jest.fn().mockResolvedValue({ outcome: 'PASSED', exports: {} });
    const mgr = new StateExecutionManager({
      agentStateRunner: mockAgent as any,
      scriptStateRunner: jest.fn() as any,
      commandStateRunner: jest.fn() as any,
      cwd,
      workflowArg,
    });

    const stateDef: StateDef = {
      id: 's',
      config: { type: 'agent' as const, expose: ['REQUIRED'] },
      transitions: [],
    };
    const ctx: WorkflowContext = { stateHistory: [] };

    await expect(mgr.executeAndExport('s', stateDef, ctx)).rejects.toThrow(/exposed variable 'REQUIRED'/);
  });

  test('does not throw for optional expose when missing', async () => {
    const mockAgent = jest.fn().mockResolvedValue({ outcome: 'PASSED', exports: {} });
    const mgr = new StateExecutionManager({
      agentStateRunner: mockAgent as any,
      scriptStateRunner: jest.fn() as any,
      commandStateRunner: jest.fn() as any,
      cwd,
      workflowArg,
    });

    const stateDef: StateDef = {
      id: 's',
      config: { type: 'agent' as const, expose: ['MAY?'] },
      transitions: [],
    };
    const ctx: WorkflowContext = { stateHistory: [] };

    await expect(mgr.executeAndExport('s', stateDef, ctx)).resolves.toBeDefined();
    expect(ctx.vars).toEqual({});
  });

  test('propagates cancellation to each external state runner', async () => {
    const cancellationToken: CancellationToken = {
      isCancellationRequested: true,
      onCancellationRequested: jest.fn(() => jest.fn()),
    };
    const mockAgent = jest.fn().mockResolvedValue({ outcome: 'CANCELLED', cancelled: true });
    const mockScript = jest.fn().mockResolvedValue({ outcome: 'CANCELLED', cancelled: true });
    const mockCommand = jest.fn().mockResolvedValue({ outcome: 'CANCELLED', cancelled: true });
    const manager = new StateExecutionManager({
      agentStateRunner: mockAgent,
      scriptStateRunner: mockScript,
      commandStateRunner: mockCommand,
      cwd,
    });
    const context: WorkflowContext = { stateHistory: [] };

    await manager.executeAndExport('agent', { id: 'agent', config: { type: 'agent' }, transitions: [] }, context, cancellationToken);
    await manager.executeAndExport('script', { id: 'script', config: { type: 'script' }, transitions: [] }, context, cancellationToken);
    await manager.executeAndExport('command', { id: 'command', config: { type: 'command' }, transitions: [] }, context, cancellationToken);

    expect(mockAgent).toHaveBeenCalledWith(expect.anything(), cwd, undefined, workflowArg, cancellationToken);
    expect(mockScript).toHaveBeenCalledWith(expect.anything(), cwd, undefined, workflowArg, cancellationToken);
    expect(mockCommand).toHaveBeenCalledWith(expect.anything(), cwd, undefined, workflowArg, cancellationToken);
  });
});
