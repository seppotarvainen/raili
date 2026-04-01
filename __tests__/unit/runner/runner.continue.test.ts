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

function makeRunner(states: StateMachine['states'], initial = 's1') {
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

test('routes via continue unconditionally regardless of outcome', async () => {
  mockRunCommand.mockResolvedValue({ outcome: 'FAILED' });

  const { runner, context } = makeRunner({
    s1: {
      id: 's1',
      config: { type: 'command', command: 'echo hi', continue: 's2' },
      transitions: ['s2'],
    },
    s2: { id: 's2', config: { type: 'engine' }, transitions: [] },
  });

  await expect(runner.run()).resolves.not.toThrow();

  expect(context.stateHistory[context.stateHistory.length - 1].state).toBe('s2');
  // Ensure s1 was entered at least once
  expect(context.stateHistory.some((e: any) => e.state === 's1')).toBe(true);
});

import { buildStateMachine, validateStateMachine } from '../../../src/workflow/workflowLoader';

test('invalid continue target causes validation error during build/validate', () => {
  const cfg: any = {
    initial: 'a',
    states: {
      a: { type: 'command', command: 'echo', continue: 'missing' },
    },
  };

  expect(() => {
    const m = buildStateMachine(cfg as any);
    validateStateMachine(m);
  }).toThrow();
});
