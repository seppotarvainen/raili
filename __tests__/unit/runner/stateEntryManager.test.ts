import { StateEntryManager } from '../../../src/runner/stateEntryManager';

describe('StateEntryManager', () => {
  const cwd = '/tmp';
  const workflowArg = 'main';

  function makeDeps() {
    const visitTracker = {
      incrementVisit: jest.fn(),
      resetVisits: jest.fn(),
    } as any;

    const outputStore = {
      clearAgentOutputs: jest.fn(),
      readLatestRun: jest.fn(),
    } as any;

    const notifyHandler = jest.fn();

    const learningStore = {
      readLearnings: jest.fn(),
    } as any;

    const contextApi = {
      record: jest.fn(),
      getHistoryCount: jest.fn(),
      getLastEntry: jest.fn(),
      vars: {},
      persist: jest.fn(),
    } as any;

    const presenter = {
      appendStateEnter: jest.fn(),
      render: jest.fn(),
    } as any;

    const presenterFactory = jest.fn().mockReturnValue(presenter);

    return { visitTracker, outputStore, notifyHandler, learningStore, contextApi, presenterFactory, presenter };
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('enforces max_visits and returns continue target when exceeded', async () => {
    const { visitTracker, outputStore, notifyHandler, learningStore, contextApi, presenterFactory } = makeDeps();
    visitTracker.incrementVisit.mockReturnValue(2);
    contextApi.record.mockReturnValue(true);

    const mgr = new StateEntryManager({
      visitTracker,
      outputStore,
      notifyHandler,
      learningStore,
      contextApi,
      presenterFactory,
      cwd,
      workflowArg,
    });

    const stateDef: any = { id: 's1', config: { max_visits: { count: 1, continue: 'next' } }, transitions: [] };

    const res = await mgr.enter('s1', stateDef);

    expect(res.continueTarget).toBe('next');
    expect(res.wasRecorded).toBe(true);
    expect(res.presenter).toBeNull();
    expect(contextApi.record).toHaveBeenCalledWith('s1', { max_visits: { exceeded: true, target: 'next' } });
  });

  test('reset_outputs triggers outputStore.clearAgentOutputs', async () => {
    const { visitTracker, outputStore, notifyHandler, learningStore, contextApi, presenterFactory, presenter } = makeDeps();
    visitTracker.incrementVisit.mockReturnValue(1);
    contextApi.record.mockReturnValue(true);
    contextApi.getHistoryCount.mockReturnValue(5);
    contextApi.getLastEntry.mockReturnValue({ enteredAt: '2026-01-01T00:00:00Z' });

    const mgr = new StateEntryManager({
      visitTracker,
      outputStore,
      notifyHandler,
      learningStore,
      contextApi,
      presenterFactory,
      cwd,
      workflowArg,
    });

    const stateDef: any = { id: 's2', config: { reset_outputs: ['a', 'b'], type: 'script' }, transitions: [] };

    const res = await mgr.enter('s2', stateDef);

    expect(outputStore.clearAgentOutputs).toHaveBeenCalledWith(cwd, ['a', 'b'], workflowArg);
    expect(res.presenter).toBe(presenter);
    expect(presenter.appendStateEnter).toHaveBeenCalled();
    expect(presenter.render).toHaveBeenCalled();
  });

  test('notify handler executed when configured and record saved', async () => {
    const { visitTracker, outputStore, notifyHandler, learningStore, contextApi, presenterFactory } = makeDeps();
    visitTracker.incrementVisit.mockReturnValue(1);
    contextApi.record.mockReturnValue(true);
    notifyHandler.mockResolvedValue({ command: 'echo', success: true });

    const mgr = new StateEntryManager({
      visitTracker,
      outputStore,
      notifyHandler,
      learningStore,
      contextApi,
      presenterFactory,
      cwd,
      workflowArg,
    });

    const stateDef: any = { id: 's3', config: { notify: 'echo hi' }, transitions: [] };

    const res = await mgr.enter('s3', stateDef);

    expect(notifyHandler).toHaveBeenCalledWith('echo hi', cwd, expect.any(Object));
    // One record for the state entry, one for notify meta
    expect(contextApi.record).toHaveBeenCalled();
    const calls = contextApi.record.mock.calls;
    expect(calls[calls.length - 1][0]).toBe('s3');
    expect(calls[calls.length - 1][1]).toEqual({ notify: { command: 'echo', success: true } });
  });

  test('creates and returns a Presenter instance', async () => {
    const { visitTracker, outputStore, notifyHandler, learningStore, contextApi, presenterFactory, presenter } = makeDeps();
    visitTracker.incrementVisit.mockReturnValue(1);
    contextApi.record.mockReturnValue(true);
    contextApi.getHistoryCount.mockReturnValue(2);
    contextApi.getLastEntry.mockReturnValue({ enteredAt: '2026-04-01T12:00:00Z' });

    const mgr = new StateEntryManager({
      visitTracker,
      outputStore,
      notifyHandler,
      learningStore,
      contextApi,
      presenterFactory,
      cwd,
      workflowArg,
    });

    const stateDef: any = { id: 's4', config: { type: 'agent', agent: 'agent1' }, transitions: [] };

    const res = await mgr.enter('s4', stateDef);

    expect(presenterFactory).toHaveBeenCalled();
    expect(res.presenter).toBe(presenter);
    expect(presenter.appendStateEnter).toHaveBeenCalledWith(stateDef, 1, 2, '2026-04-01T12:00:00Z', false, false);
  });
});
