jest.mock('../../src/presenter', () => {
  return {
    Presenter: jest.fn().mockImplementation(function (this: any) { this.renderEntry = jest.fn(); }),
  };
});

import { Runner, RunnerConfig } from '../../src/runner/Runner';
import { StateMachine, WorkflowContext } from '../../src/types';

jest.mock('../../src/context/context', () => ({
  getCurrentState: jest.fn().mockReturnValue(null),
  addStateToHistory: jest.fn((ctx: any, state: string) => ({ ...ctx, stateHistory: [...(ctx.stateHistory || []), { state, enteredAt: '2026-03-18T10:32:00Z' }] })),
  saveContext: jest.fn(),
}));

jest.mock('../../src/context/outputStore', () => ({
  readLatestRun: jest.fn().mockReturnValue(null),
}));

jest.mock('../../src/context/learningStore', () => ({
  readLearnings: jest.fn().mockReturnValue(''),
}));

import { Presenter } from '../../src/presenter';

function makeRunner(states: StateMachine['states'], initial = 'start') {
  const stateMachine: StateMachine = { initial, states } as any;
  const context: WorkflowContext = { stateHistory: [] } as any;
  return new Runner({
    stateMachine,
    agentRegistry: {},
    scriptRegistry: {},
    context,
    cwd: '/tmp',
  } as RunnerConfig);
}

beforeEach(() => jest.clearAllMocks());

test('Runner.enterState calls Presenter.renderEntry with correct args for agent state', async () => {
  const runner = makeRunner({
    start: { id: 'start', config: { type: 'agent', agent: 'a', on: { PASSED: 'done' } }, transitions: ['done'] },
    done: { id: 'done', config: { type: 'engine' }, transitions: [] },
  });

  await (runner as any).enterState('start', runner['stateMachine'].states['start']);

  const inst = (Presenter as any).mock.instances[0];
  expect(inst.renderEntry).toHaveBeenCalled();
  const arg = inst.renderEntry.mock.calls[0][0];
  expect(arg.count).toBe(1);
  expect(arg.stateName).toBe('START');
  expect(arg.type).toBe('agent');
  expect(arg.enteredAt).toBe('2026-03-18T10:32:00Z');
});

test('Runner.enterState calls Presenter.renderEntry with correct args for engine state', async () => {
  const runner = makeRunner({
    done: { id: 'done', config: { type: 'engine' }, transitions: [] },
  }, 'done');

  await (runner as any).enterState('done', runner['stateMachine'].states['done']);

  const inst = (Presenter as any).mock.instances[0];
  expect(inst.renderEntry).toHaveBeenCalled();
  const arg = inst.renderEntry.mock.calls[0][0];
  expect(arg.count).toBe(1);
  expect(arg.stateName).toBe('DONE');
  expect(arg.type).toBe('engine');
});
