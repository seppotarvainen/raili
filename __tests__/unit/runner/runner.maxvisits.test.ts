import { Runner, RunnerConfig } from '../../../src/runner/runner';
import * as commandStateRunner from '../../../src/runner/commandStateRunner';
import * as notifyHandler from '../../../src/handlers/notifyHandler';
import { StateMachine, WorkflowContext } from '../../../src/types';

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
  jest.resetAllMocks();
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
