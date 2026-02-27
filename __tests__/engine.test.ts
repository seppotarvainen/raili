import { Engine, EngineConfig } from '../src/engine/Engine';
import * as outputStore from '../src/agentOutputStore';
import * as notifyHandler from '../src/handlers/notifyHandler';
import * as agentStateRunner from '../src/engine/AgentStateRunner';
import * as scriptStateRunner from '../src/engine/ScriptStateRunner';
import * as commandStateRunner from '../src/engine/CommandStateRunner';
import { StateMachine, WorkflowContext } from '../src/types';

jest.mock('../src/agentOutputStore');
jest.mock('../src/handlers/notifyHandler');
jest.mock('../src/engine/AgentStateRunner');
jest.mock('../src/engine/ScriptStateRunner');
jest.mock('../src/engine/CommandStateRunner');
jest.mock('../src/context', () => ({
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
  mockRunAgent.mockResolvedValue('PASSED');
  mockRunScript.mockResolvedValue('PASSED');
  mockRunCommand.mockResolvedValue('PASSED');
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
  mockRunAgent.mockImplementation(async () => { callOrder.push('agent'); return 'PASSED'; });

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

