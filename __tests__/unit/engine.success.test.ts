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

// Mock context functions to inspect calls
const mockAddStateToHistory = jest.fn((ctx, state, meta) => ctx);
const mockSaveContext = jest.fn();

jest.mock('../../src/context', () => ({
  getCurrentState: jest.fn().mockReturnValue(null),
  addStateToHistory: mockAddStateToHistory,
  saveContext: mockSaveContext,
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

test('persists success:true for terminal engine state', async () => {
  const engine = makeEngine({
    start: { id: 'start', config: { type: 'engine', success: true }, transitions: [] },
  });

  await engine.run();

  // Expect addStateToHistory to be called with meta containing success: true
  expect(mockAddStateToHistory.mock.calls.some((c) => c[1] === 'start' && c[2] && c[2].success === true)).toBe(true);
  expect(mockSaveContext).toHaveBeenCalled();
});

test('persists success:null when success omitted for terminal engine state', async () => {
  const engine = makeEngine({
    start: { id: 'start', config: { type: 'engine' }, transitions: [] },
  });

  await engine.run();

  // success should be explicitly recorded as null
  expect(mockAddStateToHistory.mock.calls.some((c) => c[1] === 'start' && c[2] && c[2].success === null)).toBe(true);
  expect(mockSaveContext).toHaveBeenCalled();
});
