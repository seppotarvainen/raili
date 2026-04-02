import { Runner, RunnerConfig } from '../../../src/runner/runner';
import * as commandStateRunner from '../../../src/runner/commandStateRunner';
import * as notifyHandler from '../../../src/handlers/notifyHandler';
import { StateMachine, WorkflowContext } from '../../../src/types';
import { buildStateMachine, validateStateMachine } from '../../../src/workflow/workflowLoader';

jest.mock('../../../src/runner/commandStateRunner');
jest.mock('../../../src/handlers/notifyHandler');

// Provide a context mock that records stateHistory entries so tests can assert on meta
jest.mock('../../../src/context/context', () => ({
  getCurrentState: jest.fn().mockReturnValue(null),
  addStateToHistory: jest.fn((ctx: any, stateId: string, meta?: any) => {
    if (!ctx.stateHistory) ctx.stateHistory = [];
    ctx.stateHistory.push({ state: stateId, enteredAt: new Date().toISOString(), meta });
    return ctx;
  }),
  saveContext: jest.fn(),
}));

const mockRunCommand = commandStateRunner.runCommandState as jest.MockedFunction<
  typeof commandStateRunner.runCommandState
>;

function makeRunner(states: StateMachine['states'], initial = 'start') {
  const stateMachine: StateMachine = { initial, states };
  const context: WorkflowContext = { stateHistory: [] };
  const runner = new Runner({
    stateMachine,
    agentRegistry: {},
    scriptRegistry: {},
    context,
    cwd: '/tmp',
  } as RunnerConfig);
  return { runner, context };
}

beforeEach(() => {
  jest.clearAllMocks();
  (notifyHandler.runNotify as jest.Mock).mockResolvedValue(undefined);
});

test('routes to continue target when max_visits exceeded and continue provided', async () => {
  // Simulate a command that always fails and would normally route back to 'start'
  mockRunCommand.mockResolvedValue({ outcome: 'FAILED' });

  const { runner, context } = makeRunner({
    start: {
      id: 'start',
      config: {
        type: 'command',
        command: 'echo hi',
        max_visits: { count: 1, continue: 'done' },
        on: { PASSED: 'done', FAILED: 'start' },
      },
      transitions: ['done', 'start'],
    },
    done: { id: 'done', config: { type: 'engine' }, transitions: [] },
  });

  await expect(runner.run()).resolves.not.toThrow();

  // The command handler should have been invoked only once (the second entry is short-circuited)
  expect(mockRunCommand).toHaveBeenCalledTimes(1);

  // The command handler should have been invoked only once (the second entry is short-circuited)
  expect(mockRunCommand).toHaveBeenCalledTimes(1);

  // No exception should be thrown and run completes (implicit by resolves above).
});

test('validation fails when reset_max_visits references unknown state', () => {
  const cfg: any = {
    initial: 'start',
    states: {
      start: { type: 'engine', reset_max_visits: ['nowhere'] },
    },
  };

  const machine = buildStateMachine(cfg as any);
  expect(() => validateStateMachine(machine)).toThrow(/unknown state 'nowhere'/);
});

// New test: ensure reset_max_visits clears visitCounts in-memory so inner loops can reuse their budget per outer iteration
test('reset_max_visits resets visit counter for specified states', async () => {
  // Plan: outer resets inner's visit counter; inner has max_visits.count = 2
  // Sequence of inner command outcomes across the run: FAILED, PASSED, FAILED, TERMINATE
  mockRunCommand
    .mockResolvedValueOnce({ outcome: 'FAILED' })
    .mockResolvedValueOnce({ outcome: 'PASSED' })
    .mockResolvedValueOnce({ outcome: 'FAILED' })
    .mockResolvedValueOnce({ outcome: 'TERMINATE' });

  const { runner, context } = makeRunner(
    {
      outer: {
        id: 'outer',
        config: {
          type: 'engine',
          reset_max_visits: ['inner'],
          on: { PASSED: 'inner' },
        },
        transitions: ['inner'],
      },
      inner: {
        id: 'inner',
        config: {
          type: 'command',
          command: 'do',
          max_visits: { count: 2 },
          transitions: { FAILED: 'inner', PASSED: 'outer', TERMINATE: 'end' },
        },
        transitions: ['inner', 'outer', 'end'],
      },
      end: { id: 'end', config: { type: 'engine' }, transitions: [] },
    },
    'outer',
  );

  await expect(runner.run()).resolves.not.toThrow();

  // Inner should have been invoked 4 times (2 per outer iteration)
  expect(mockRunCommand).toHaveBeenCalledTimes(4);

  // Final recorded state should be 'end'
  expect(context.stateHistory[context.stateHistory.length - 1].state).toBe('end');
});
