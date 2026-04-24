import { TeachManager } from '../../../src/runner/teachManager';

describe('TeachManager', () => {
  test('no teach config is a no-op', async () => {
    const readLatestRun = jest.fn();
    const appendUniqueLearning = jest.fn();
    const record = jest.fn();

    const mgr = new TeachManager({
      cwd: '/tmp',
      workflowArg: undefined,
      agentRegistry: {},
      readLatestRun: readLatestRun as any,
      appendUniqueLearning: appendUniqueLearning as any,
      record: record as any,
      contextVars: {},
    });

    await expect(mgr.teach('s', { config: {} } as any)).resolves.toBeUndefined();
    expect(appendUniqueLearning).not.toHaveBeenCalled();
    expect(record).not.toHaveBeenCalled();
  });

  test('throws when referenced agent missing', async () => {
    const readLatestRun = jest.fn();
    const appendUniqueLearning = jest.fn();
    const record = jest.fn();

    const mgr = new TeachManager({
      cwd: '/tmp',
      workflowArg: undefined,
      agentRegistry: { a: { path: 'a.md' } },
      readLatestRun: readLatestRun as any,
      appendUniqueLearning: appendUniqueLearning as any,
      record: record as any,
      contextVars: {},
    });

    const stateDef: any = { config: { teach: { missingAgent: [{ output: 's1' }] } } };

    await expect(mgr.teach('s', stateDef)).rejects.toThrow("teach references missing agents");
  });

  test('appends learning for output and records meta', async () => {
    const readLatestRun = jest.fn().mockReturnValue('lesson content');
    const appendUniqueLearning = jest.fn().mockReturnValue(true);
    const record = jest.fn();

    const mgr = new TeachManager({
      cwd: '/tmp',
      workflowArg: undefined,
      agentRegistry: { agent1: { path: 'agent.md' } },
      readLatestRun: readLatestRun as any,
      appendUniqueLearning: appendUniqueLearning as any,
      record: record as any,
      contextVars: {},
    });

    const stateDef: any = {
      config: { teach: { agent1: [{ output: 's1', scope: 'workflow' }] } },
    };

    await mgr.teach('start', stateDef);

    expect(appendUniqueLearning).toHaveBeenCalledWith('/tmp', 'agent1', 'output:s1', 'lesson content', undefined, 'workflow');
    expect(record).toHaveBeenCalledWith('start', expect.objectContaining({ teach: expect.any(Array) }));
  });

  test('throws when referenced var missing from context', async () => {
    const readLatestRun = jest.fn();
    const appendUniqueLearning = jest.fn();
    const record = jest.fn();

    const mgr = new TeachManager({
      cwd: '/tmp',
      workflowArg: undefined,
      agentRegistry: { agent1: { path: 'agent.md' } },
      readLatestRun: readLatestRun as any,
      appendUniqueLearning: appendUniqueLearning as any,
      record: record as any,
      contextVars: {},
    });

    const stateDef: any = {
      config: { teach: { agent1: [{ var: '${MISSING_VAR}' }] } },
    };

    await expect(mgr.teach('start', stateDef)).rejects.toThrow("teach var 'MISSING_VAR' not found in context");
  });

  test('uses getContextVars when provided and appends var learning', async () => {
    const readLatestRun = jest.fn();
    const appendUniqueLearning = jest.fn().mockReturnValue(true);
    const record = jest.fn();

    const mgr = new TeachManager({
      cwd: '/tmp',
      workflowArg: undefined,
      agentRegistry: { agent1: { path: 'agent.md' } },
      readLatestRun: readLatestRun as any,
      appendUniqueLearning: appendUniqueLearning as any,
      record: record as any,
      contextVars: {},
      getContextVars: () => ({ MYVAR: 'the value' }),
    });

    const stateDef: any = {
      config: { teach: { agent1: [{ var: '${MYVAR}', scope: 'workflow' }] } },
    };

    await mgr.teach('start', stateDef);

    expect(appendUniqueLearning).toHaveBeenCalledWith('/tmp', 'agent1', 'var:MYVAR', 'the value', undefined, 'workflow');
    expect(record).toHaveBeenCalledWith('start', expect.objectContaining({ teach: expect.any(Array) }));
  });

  test('throws when teach var entry has invalid format', async () => {
    const mgr = new TeachManager({
      cwd: '/tmp',
      workflowArg: undefined,
      agentRegistry: { agent1: { path: 'agent.md' } },
      readLatestRun: jest.fn() as any,
      appendUniqueLearning: jest.fn() as any,
      record: jest.fn() as any,
      contextVars: { FOO: 'bar' },
    });

    const stateDef: any = {
      config: { teach: { agent1: [{ var: 'NOT_A_VAR' }] } },
    };

    await expect(mgr.teach('start', stateDef)).rejects.toThrow("teach var entry 'NOT_A_VAR' must be in the form");
  });

  test('throws when referenced output has no content', async () => {
    const readLatestRun = jest.fn().mockReturnValue('');
    const appendUniqueLearning = jest.fn();
    const record = jest.fn();

    const mgr = new TeachManager({
      cwd: '/tmp',
      workflowArg: undefined,
      agentRegistry: { agent1: { path: 'agent.md' } },
      readLatestRun: readLatestRun as any,
      appendUniqueLearning: appendUniqueLearning as any,
      record: record as any,
      contextVars: {},
    });

    const stateDef: any = {
      config: { teach: { agent1: [{ output: 's1' }] } },
    };

    await expect(mgr.teach('start', stateDef)).rejects.toThrow("teach referenced output 's1' produced no content");
  });

  test('does not record when no new learning appended', async () => {
    const readLatestRun = jest.fn().mockReturnValue('content');
    const appendUniqueLearning = jest.fn().mockReturnValue(false);
    const record = jest.fn();

    const mgr = new TeachManager({
      cwd: '/tmp',
      workflowArg: undefined,
      agentRegistry: { agent1: { path: 'agent.md' } },
      readLatestRun: readLatestRun as any,
      appendUniqueLearning: appendUniqueLearning as any,
      record: record as any,
      contextVars: {},
    });

    const stateDef: any = {
      config: { teach: { agent1: [{ output: 's1' }] } },
    };

    await mgr.teach('start', stateDef);

    expect(record).not.toHaveBeenCalled();
  });
});
