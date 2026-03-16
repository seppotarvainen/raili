import { Engine, EngineConfig } from '../../src/engine/Engine';
import * as outputStore from '../../src/outputStore';
import * as notifyHandler from '../../src/handlers/notifyHandler';
import * as agentStateRunner from '../../src/engine/AgentStateRunner';
import * as scriptStateRunner from '../../src/engine/ScriptStateRunner';
import * as commandStateRunner from '../../src/engine/CommandStateRunner';
import { StateMachine, WorkflowContext } from '../../src/types';

jest.mock('../../src/outputStore');
jest.mock('../../src/handlers/notifyHandler');
jest.mock('../../src/engine/AgentStateRunner');
jest.mock('../../src/engine/ScriptStateRunner');
jest.mock('../../src/engine/CommandStateRunner');
jest.mock('../../src/context', () => ({
  getCurrentState: jest.fn().mockReturnValue(null),
  addStateToHistory: jest.fn((ctx) => ctx),
  saveContext: jest.fn(),
}));

const mockClear = outputStore.clearAgentOutputs as jest.MockedFunction<typeof outputStore.clearAgentOutputs>;
const mockRunAgent = agentStateRunner.runAgentState as jest.MockedFunction<typeof agentStateRunner.runAgentState>;
const mockRunScript = scriptStateRunner.runScriptState as jest.MockedFunction<typeof scriptStateRunner.runScriptState>;
const mockRunCommand = commandStateRunner.runCommandState as jest.MockedFunction<typeof commandStateRunner.runCommandState>;

function makeEngine(states: StateMachine['states'], initial = 'start'): Engine {
  const stateMachine: StateMachine = { initial, states };
  const context: WorkflowContext = { stateHistory: [] };
  return new Engine({
    stateMachine,
    agentRegistry: {},
    scriptRegistry: {},
    context,
    cwd: '/tmp',
  } as EngineConfig);
}

beforeEach(() => {
  jest.resetAllMocks();
  (notifyHandler.runNotify as jest.Mock).mockResolvedValue(undefined);
  mockRunAgent.mockResolvedValue({ outcome: 'PASSED' });
  mockRunScript.mockResolvedValue({ outcome: 'PASSED' });
  mockRunCommand.mockResolvedValue({ outcome: 'PASSED' });
});

test('clears reset_outputs on entry for agent state', async () => {
  const engine = makeEngine({
    start: {
      id: 'start',
      config: { type: 'agent', agent: 'a', reset_outputs: ['code', 'analyze'], on: { PASSED: 'done' } },
      transitions: ['done'],
    },
    done: { id: 'done', config: { type: 'engine' }, transitions: [] },
  });

  await engine.run();

  expect(mockClear).toHaveBeenCalledWith('/tmp', ['code', 'analyze']);
});

test('clears reset_outputs on entry for engine state', async () => {
  const engine = makeEngine({
    start: {
      id: 'start',
      config: { type: 'engine', reset_outputs: ['code'], on: { PASSED: 'done' } },
      transitions: ['done'],
    },
    done: { id: 'done', config: { type: 'engine' }, transitions: [] },
  });

  await engine.run();

  expect(mockClear).toHaveBeenCalledWith('/tmp', ['code']);
});

test('clears reset_outputs on entry for script state', async () => {
  const engine = makeEngine({
    start: {
      id: 'start',
      config: { type: 'script', script: 's', reset_outputs: ['code'], on: { PASSED: 'done' } },
      transitions: ['done'],
    },
    done: { id: 'done', config: { type: 'engine' }, transitions: [] },
  });

  await engine.run();

  expect(mockClear).toHaveBeenCalledWith('/tmp', ['code']);
});

test('clears reset_outputs on entry for command state', async () => {
  const engine = makeEngine({
    start: {
      id: 'start',
      config: { type: 'command', command: 'echo hi', reset_outputs: ['code'], on: { PASSED: 'done' } },
      transitions: ['done'],
    },
    done: { id: 'done', config: { type: 'engine' }, transitions: [] },
  });

  await engine.run();

  expect(mockClear).toHaveBeenCalledWith('/tmp', ['code']);
});

test('clears reset_outputs on entry for terminal engine state', async () => {
  const engine = makeEngine({
    start: {
      id: 'start',
      config: { type: 'engine', reset_outputs: ['code'] },
      transitions: [],
    },
  });

  await engine.run();

  expect(mockClear).toHaveBeenCalledWith('/tmp', ['code']);
});

test('does not call clearAgentOutputs when reset_outputs is not set', async () => {
  const engine = makeEngine({
    start: {
      id: 'start',
      config: { type: 'engine', on: { PASSED: 'done' } },
      transitions: ['done'],
    },
    done: { id: 'done', config: { type: 'engine' }, transitions: [] },
  });

  await engine.run();

  expect(mockClear).not.toHaveBeenCalled();
});

test('clears reset_outputs before notify and handler run', async () => {
  const callOrder: string[] = [];
  mockClear.mockImplementation(() => { callOrder.push('clear'); });
  (notifyHandler.runNotify as jest.Mock).mockImplementation(async () => { callOrder.push('notify'); });
  mockRunAgent.mockImplementation(async () => { callOrder.push('agent'); return { outcome: 'PASSED' }; });

  const engine = makeEngine({
    start: {
      id: 'start',
      config: { type: 'agent', agent: 'a', reset_outputs: ['code'], notify: 'echo hi', on: { PASSED: 'done' } },
      transitions: ['done'],
    },
    done: { id: 'done', config: { type: 'engine' }, transitions: [] },
  });

  await engine.run();

  expect(callOrder).toEqual(['clear', 'notify', 'agent']);
});

test('throws when state exceeds max_visits', async () => {
  mockRunCommand.mockResolvedValue({ outcome: 'FAILED' });
  const engine = makeEngine({
    start: {
      id: 'start',
      config: { type: 'command', command: 'echo hi', max_visits: 3, on: { PASSED: 'done', FAILED: 'start' } },
      transitions: ['done', 'start'],
    },
    done: { id: 'done', config: { type: 'engine' }, transitions: [] },
  });

  await expect(engine.run()).rejects.toThrow("State 'start' exceeded max_visits limit of 3");
  expect(mockRunCommand).toHaveBeenCalledTimes(3);
});

test('does not throw when visits are within max_visits', async () => {
  mockRunCommand.mockResolvedValue({ outcome: 'PASSED' });
  const engine = makeEngine({
    start: {
      id: 'start',
      config: { type: 'command', command: 'echo hi', max_visits: 3, on: { PASSED: 'done', FAILED: 'start' } },
      transitions: ['done', 'start'],
    },
    done: { id: 'done', config: { type: 'engine' }, transitions: [] },
  });

  await expect(engine.run()).resolves.not.toThrow();
});

test('max_visits counter resets independently per state', async () => {
  let callCount = 0;
  mockRunCommand.mockImplementation(async () => {
    callCount++;
    return { outcome: callCount <= 2 ? 'RETRY' : 'PASSED' };
  });

  const engine = makeEngine({
    start: {
      id: 'start',
      config: { type: 'command', command: 'echo hi', max_visits: 5, transitions: { RETRY: 'start', PASSED: 'done' } },
      transitions: ['start', 'done'],
    },
    done: { id: 'done', config: { type: 'engine' }, transitions: [] },
  });

  await expect(engine.run()).resolves.not.toThrow();
  expect(mockRunCommand).toHaveBeenCalledTimes(3);
});

test('uses default transition for agent state with unexpected outcome', async () => {
  (mockRunAgent as jest.Mock).mockResolvedValue({ outcome: 'UNKNOWN_OUTCOME' });
  const ctx = require('../../src/context');
  const engine = makeEngine({
    start: { id: 'start', config: { type: 'agent', agent: 'a', transitions: { OK: 'ok', default: 'fallback' } }, transitions: ['ok', 'fallback'] },
    fallback: { id: 'fallback', config: { type: 'engine' }, transitions: [] },
  });
  await engine.run();
  expect(ctx.addStateToHistory.mock.calls.some((c: any) => c[1] === 'fallback')).toBe(true);
});

test('uses default transition for script/command state with unexpected outcome', async () => {
  (mockRunScript as jest.Mock).mockResolvedValue({ outcome: 'WEIRD' });
  const ctx = require('../../src/context');
  const engine = makeEngine({
    start: { id: 'start', config: { type: 'script', script: 's', transitions: { PASSED: 'ok', default: 'rework' } }, transitions: ['ok', 'rework'] },
    rework: { id: 'rework', config: { type: 'engine' }, transitions: [] },
  });
  await engine.run();
  expect(ctx.addStateToHistory.mock.calls.some((c: any) => c[1] === 'rework')).toBe(true);
});

test('throws when outcome not mapped and no default provided', async () => {
  (mockRunCommand as jest.Mock).mockResolvedValue({ outcome: 'STRANGE' });
  const engine = makeEngine({
    start: { id: 'start', config: { type: 'command', command: 'echo hi', transitions: { PASSED: 'done' } }, transitions: ['done'] },
    done: { id: 'done', config: { type: 'engine' }, transitions: [] },
  });
  await expect(engine.run()).rejects.toThrow("has no matching transition");
});

