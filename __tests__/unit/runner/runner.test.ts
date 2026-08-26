import {Runner, RunnerConfig} from '../../../src/runner/runner';
import * as outputStore from '../../../src/context/outputStore';
import * as notifyHandler from '../../../src/handlers/notifyHandler';
import * as agentStateRunner from '../../../src/runner/agentStateRunner';
import * as scriptStateRunner from '../../../src/runner/scriptStateRunner';
import * as commandStateRunner from '../../../src/runner/commandStateRunner';
import * as learningStore from '../../../src/context/learningStore';
import {CancellationToken, StateMachine, StateMeta, WorkflowContext} from '../../../src/types';
import * as contextApi from '../../../src/context/context';

jest.mock('../../../src/context/outputStore');
jest.mock('../../../src/handlers/notifyHandler');
jest.mock('../../../src/runner/agentStateRunner');
jest.mock('../../../src/runner/scriptStateRunner');
jest.mock('../../../src/runner/commandStateRunner');
jest.mock('../../../src/context/learningStore');
jest.mock('../../../src/context/context', () => ({
  getCurrentState: jest.fn().mockReturnValue(null),
  addStateToHistory: jest.fn((ctx) => ctx),
  saveContext: jest.fn(),
}));

const mockClear = outputStore.clearAgentOutputs as jest.MockedFunction<typeof outputStore.clearAgentOutputs>;
const mockRunAgent = agentStateRunner.runAgentState as jest.MockedFunction<typeof agentStateRunner.runAgentState>;
const mockRunScript = scriptStateRunner.runScriptState as jest.MockedFunction<typeof scriptStateRunner.runScriptState>;
const mockRunCommand = commandStateRunner.runCommandState as jest.MockedFunction<typeof commandStateRunner.runCommandState>;
const mockAppendUnique = learningStore.appendUniqueLearning as jest.MockedFunction<typeof learningStore.appendUniqueLearning>;

function makeRunner(states: StateMachine['states'], initial = 'start', nextSteps?: number, agentRegistry: any = { agent1: { path: 'agent.md' }, a: { path: 'agent.md' } }, cancellationToken?: CancellationToken): Runner {
  const stateMachine: StateMachine = { initial, states };
  const context: WorkflowContext = { stateHistory: [] };
  return new Runner({
    stateMachine,
    agentRegistry,
    scriptRegistry: {},
    context,
    cwd: '/tmp',
    nextSteps,
    cancellationToken,
  } as RunnerConfig);
}

beforeEach(() => {
  jest.clearAllMocks();
  (notifyHandler.runNotify as jest.Mock).mockResolvedValue(undefined);
  mockRunAgent.mockResolvedValue({ outcome: 'PASSED' });
  mockRunScript.mockResolvedValue({ outcome: 'PASSED' });
  mockRunCommand.mockResolvedValue({ outcome: 'PASSED' });
});

test('clears reset_outputs on entry for agent state', async () => {
  const runner = makeRunner({
    start: {
      id: 'start',
      config: { type: 'agent', agent: 'a', reset_outputs: ['code', 'analyze'], on: { PASSED: 'done' } },
      transitions: ['done'],
    },
    done: { id: 'done', config: { type: 'engine' }, transitions: [] },
  });

  await runner.run();

  expect(mockClear).toHaveBeenCalledWith('/tmp', ['code', 'analyze'], undefined);
});

test('clears reset_outputs on entry for engine state', async () => {
  const runner = makeRunner({
    start: {
      id: 'start',
      config: { type: 'engine', reset_outputs: ['code'], on: { PASSED: 'done' } },
      transitions: ['done'],
    },
    done: { id: 'done', config: { type: 'engine' }, transitions: [] },
  });

  await runner.run();

  expect(mockClear).toHaveBeenCalledWith('/tmp', ['code'], undefined);
});

test('clears reset_outputs on entry for script state', async () => {
  const runner = makeRunner({
    start: {
      id: 'start',
      config: { type: 'script', script: 's', reset_outputs: ['code'], on: { PASSED: 'done' } },
      transitions: ['done'],
    },
    done: { id: 'done', config: { type: 'engine' }, transitions: [] },
  });

  await runner.run();

  expect(mockClear).toHaveBeenCalledWith('/tmp', ['code'], undefined);
});

test('clears reset_outputs on entry for command state', async () => {
  const runner = makeRunner({
    start: {
      id: 'start',
      config: { type: 'command', command: 'echo hi', reset_outputs: ['code'], on: { PASSED: 'done' } },
      transitions: ['done'],
    },
    done: { id: 'done', config: { type: 'engine' }, transitions: [] },
  });

  await runner.run();

  expect(mockClear).toHaveBeenCalledWith('/tmp', ['code'], undefined);
});

test('clears reset_outputs on entry for terminal engine state', async () => {
  const runner = makeRunner({
    start: {
      id: 'start',
      config: { type: 'engine', reset_outputs: ['code'] },
      transitions: [],
    },
  });

  await runner.run();

  expect(mockClear).toHaveBeenCalledWith('/tmp', ['code'], undefined);
});

test('does not call clearAgentOutputs when reset_outputs is not set', async () => {
  const runner = makeRunner({
    start: {
      id: 'start',
      config: { type: 'engine', on: { PASSED: 'done' } },
      transitions: ['done'],
    },
    done: { id: 'done', config: { type: 'engine' }, transitions: [] },
  });

  await runner.run();

  expect(mockClear).not.toHaveBeenCalled();
});

test('records cancellation and stops without routing to a successor', async () => {
  const cancellationToken: CancellationToken = {
    isCancellationRequested: false,
    onCancellationRequested: jest.fn(() => jest.fn()),
  };
  mockRunAgent.mockResolvedValue({ outcome: 'CANCELLED', cancelled: true });
  const runner = makeRunner(
    {
      start: {
        id: 'start',
        config: { type: 'agent', agent: 'a', transitions: { approve: 'done', reject: 'retry' } },
        transitions: ['done', 'retry'],
      },
      done: { id: 'done', config: { type: 'engine' }, transitions: [] },
      retry: { id: 'retry', config: { type: 'engine' }, transitions: [] },
    },
    'start',
    undefined,
    undefined,
    cancellationToken,
  );

  await expect(runner.run()).resolves.toBeUndefined();

  const cancellationRecord = (contextApi.addStateToHistory as jest.Mock).mock.calls.find(
    (call: [unknown, string, { cancelled?: string } | undefined]) =>
      call[1] === 'start' && call[2]?.cancelled,
  );
  expect(cancellationRecord?.[2]?.cancelled).toEqual(expect.any(String));
  expect((contextApi.saveContext as jest.Mock).mock.calls.length).toBeGreaterThan(0);
  const enteredStates = (contextApi.addStateToHistory as jest.Mock).mock.calls.map(
    (call: unknown[]) => call[1],
  );
  expect(enteredStates).not.toContain('done');
  expect(enteredStates).not.toContain('retry');
});

test('records cancellation when the token is already requested before execution', async () => {
  const cancellationToken: CancellationToken = {
    isCancellationRequested: true,
    onCancellationRequested: jest.fn(() => jest.fn()),
  };
  const runner = makeRunner(
    {
      start: {
        id: 'start',
        config: { type: 'command', command: 'echo hi', on: { PASSED: 'done' } },
        transitions: ['done'],
      },
      done: { id: 'done', config: { type: 'engine' }, transitions: [] },
    },
    'start',
    undefined,
    undefined,
    cancellationToken,
  );

  await expect(runner.run()).resolves.toBeUndefined();

  expect(mockRunCommand).not.toHaveBeenCalled();
  const enteredStates = (contextApi.addStateToHistory as jest.Mock).mock.calls.map(
    (call: unknown[]) => call[1],
  );
  expect(enteredStates).toContain('start');
  expect(enteredStates).not.toContain('done');
  expect((contextApi.saveContext as jest.Mock).mock.calls.length).toBeGreaterThan(0);
});

test('persists cancellation metadata on the active state when child completion races cancellation', async () => {
  let cancellationRequested = false;
  const cancellationToken: CancellationToken = {
    get isCancellationRequested() {
      return cancellationRequested;
    },
    onCancellationRequested: jest.fn(() => jest.fn()),
  };
  const context: WorkflowContext = { stateHistory: [] };
  const savedContexts: WorkflowContext[] = [];
  const addState = contextApi.addStateToHistory as jest.MockedFunction<typeof contextApi.addStateToHistory>;
  const save = contextApi.saveContext as jest.MockedFunction<typeof contextApi.saveContext>;
  const originalAddState = addState.getMockImplementation();
  const originalSave = save.getMockImplementation();

  addState.mockImplementation((ctx, state, meta?: StateMeta) => {
    const existing = [...ctx.stateHistory].reverse().find((entry) => entry.state === state);
    if (existing) {
      if (meta) {
        existing.meta = { ...existing.meta, ...meta };
      }
      return ctx;
    }
    ctx.stateHistory.push({
      state,
      enteredAt: '2026-08-26T07:00:00.000Z',
      meta: meta ?? {},
    });
    return ctx;
  });
  save.mockImplementation((_cwd, ctx) => {
    savedContexts.push(JSON.parse(JSON.stringify(ctx)) as WorkflowContext);
  });
  mockRunCommand.mockImplementation(async () => {
    cancellationRequested = true;
    return { outcome: 'FAILED' };
  });

  try {
    const runner = new Runner({
      stateMachine: {
        initial: 'check_done',
        states: {
          check_done: {
            id: 'check_done',
            config: {
              type: 'command',
              command: 'echo hi',
              on: { PASSED: 'finished', FAILED: 'revise' },
            },
            transitions: ['finished', 'revise'],
          },
          finished: { id: 'finished', config: { type: 'engine' }, transitions: [] },
          revise: { id: 'revise', config: { type: 'engine' }, transitions: [] },
        },
      },
      agentRegistry: {},
      scriptRegistry: {},
      context,
      cwd: '/tmp',
      cancellationToken,
    });

    await expect(runner.run()).resolves.toBeUndefined();

    const persisted = savedContexts[savedContexts.length - 1];
    expect(persisted.stateHistory).toHaveLength(1);
    expect(persisted.stateHistory[0]).toMatchObject({
      state: 'check_done',
      enteredAt: '2026-08-26T07:00:00.000Z',
      meta: { cancelled: expect.any(String) },
    });
    expect(Number.isNaN(Date.parse(persisted.stateHistory[0].meta?.cancelled as string))).toBe(false);
  } finally {
    addState.mockImplementation(originalAddState ?? ((ctx) => ctx));
    save.mockImplementation(originalSave ?? (() => undefined));
  }
});

test('clears reset_outputs before notify and handler run', async () => {
  const callOrder: string[] = [];
  mockClear.mockImplementation(() => { callOrder.push('clear'); });
  (notifyHandler.runNotify as jest.Mock).mockImplementation(async () => { callOrder.push('notify'); });
  mockRunAgent.mockImplementation(async () => { callOrder.push('agent'); return { outcome: 'PASSED' }; });

  const runner = makeRunner({
    start: {
      id: 'start',
      config: { type: 'agent', agent: 'a', reset_outputs: ['code'], notify: 'echo hi', on: { PASSED: 'done' } },
      transitions: ['done'],
    },
    done: { id: 'done', config: { type: 'engine' }, transitions: [] },
  });

  await runner.run();

  expect(callOrder).toEqual(['clear', 'notify', 'agent']);
});

test('throws when state exceeds max_visits', async () => {
  mockRunCommand.mockResolvedValue({ outcome: 'FAILED' });
  const runner = makeRunner({
    start: {
      id: 'start',
      config: { type: 'command', command: 'echo hi', max_visits: { count: 3 }, on: { PASSED: 'done', FAILED: 'start' } },
      transitions: ['done', 'start'],
    },
    done: { id: 'done', config: { type: 'engine' }, transitions: [] },
  });

  await expect(runner.run()).rejects.toThrow("State 'start' exceeded max_visits limit of 3");
  expect(mockRunCommand).toHaveBeenCalledTimes(3);
});

test('does not throw when visits are within max_visits', async () => {
  mockRunCommand.mockResolvedValue({ outcome: 'PASSED' });
  const runner = makeRunner({
    start: {
      id: 'start',
      config: { type: 'command', command: 'echo hi', max_visits: { count: 3 }, on: { PASSED: 'done', FAILED: 'start' } },
      transitions: ['done', 'start'],
    },
    done: { id: 'done', config: { type: 'engine' }, transitions: [] },
  });

  await expect(runner.run()).resolves.not.toThrow();
});

test('max_visits counter resets independently per state', async () => {
  let callCount = 0;
  mockRunCommand.mockImplementation(async () => {
    callCount++;
    return { outcome: callCount <= 2 ? 'RETRY' : 'PASSED' };
  });

  const runner = makeRunner({
    start: {
      id: 'start',
      config: { type: 'command', command: 'echo hi', max_visits: { count: 5 }, transitions: { RETRY: 'start', PASSED: 'done' } },
      transitions: ['start', 'done'],
    },
    done: { id: 'done', config: { type: 'engine' }, transitions: [] },
  });

  await expect(runner.run()).resolves.not.toThrow();
  expect(mockRunCommand).toHaveBeenCalledTimes(3);
});

test('uses default transition for agent state with unexpected outcome', async () => {
  (mockRunAgent as jest.Mock).mockResolvedValue({ outcome: 'UNKNOWN_OUTCOME' });
  const ctx = require('../../../src/context/context');
  const runner = makeRunner({
    start: { id: 'start', config: { type: 'agent', agent: 'a', transitions: { OK: 'ok', default: 'fallback' } }, transitions: ['ok', 'fallback'] },
    fallback: { id: 'fallback', config: { type: 'engine' }, transitions: [] },
  });
  await runner.run();
  expect(ctx.addStateToHistory.mock.calls.some((c: any) => c[1] === 'fallback')).toBe(true);
});

test('uses default transition for script/command state with unexpected outcome', async () => {
  (mockRunScript as jest.Mock).mockResolvedValue({ outcome: 'WEIRD' });
  const ctx = require('../../../src/context/context');
  const runner = makeRunner({
    start: { id: 'start', config: { type: 'script', script: 's', transitions: { PASSED: 'ok', default: 'rework' } }, transitions: ['ok', 'rework'] },
    rework: { id: 'rework', config: { type: 'engine' }, transitions: [] },
  });
  await runner.run();
  expect(ctx.addStateToHistory.mock.calls.some((c: any) => c[1] === 'rework')).toBe(true);
});

test('throws when outcome not mapped and no default provided', async () => {
  (mockRunCommand as jest.Mock).mockResolvedValue({ outcome: 'STRANGE' });
  const runner = makeRunner({
    start: { id: 'start', config: { type: 'command', command: 'echo hi', transitions: { PASSED: 'done' } }, transitions: ['done'] },
    done: { id: 'done', config: { type: 'engine' }, transitions: [] },
  });
  await expect(runner.run()).rejects.toThrow("has no matching transition");
});

test('handleTeach passes scope to appendUniqueLearning', async () => {
  // ensure readLatestRun returns content for referenced output
  (outputStore.readLatestRun as jest.MockedFunction<any>).mockReturnValue('lesson content');
  (learningStore.appendUniqueLearning as jest.Mock).mockReturnValue(true);

  const runner = makeRunner({
    start: {
      id: 'start',
      config: {
        type: 'engine',
        teach: {
          agent1: [{ output: 's1', scope: 'workflow' }],
        },
        on: { PASSED: 'done' },
      },
      transitions: ['done'],
    },
    done: { id: 'done', config: { type: 'engine' }, transitions: [] },
  });

  await runner.run();

  expect(learningStore.appendUniqueLearning).toHaveBeenCalledWith('/tmp', 'agent1', 'output:s1', 'lesson content', undefined, 'workflow');
});


// nextSteps behavior tests

test('stops after nextSteps limit on linear workflow', async () => {
  const ctx = require('../../../src/context/context');
  const runner = makeRunner({
    start: { id: 'start', config: { type: 'engine', on: { PASSED: 's2' } }, transitions: ['s2'] },
    s2: { id: 's2', config: { type: 'engine', on: { PASSED: 's3' } }, transitions: ['s3'] },
    s3: { id: 's3', config: { type: 'engine' }, transitions: [] },
  }, 'start', 2);

  await runner.run();

  const calledStates = ctx.addStateToHistory.mock.calls.map((c: any) => c[1]);
  expect(calledStates).toContain('start');
  expect(calledStates).toContain('s2');
  expect(calledStates).not.toContain('s3');
});

test('stops after nextSteps limit for branching', async () => {
  const ctx = require('../../../src/context/context');
  const runner = makeRunner({
    start: { id: 'start', config: { type: 'engine', transitions: { NEXT: 'b1' } }, transitions: ['b1'] },
    b1: { id: 'b1', config: { type: 'engine' }, transitions: [] },
  }, 'start', 1);

  await runner.run();

  const calledStates = ctx.addStateToHistory.mock.calls.map((c: any) => c[1]);
  // only start should be present
  expect(calledStates).toContain('start');
  expect(calledStates).not.toContain('b1');
});

test('stops when terminal reached before limit', async () => {
  const ctx = require('../../../src/context/context');
  const runner = makeRunner({
    start: { id: 'start', config: { type: 'engine' }, transitions: [] },
  }, 'start', 5);

  await runner.run();

  const calledStates = ctx.addStateToHistory.mock.calls.map((c: any) => c[1]);
  expect(calledStates).toContain('start');
});
