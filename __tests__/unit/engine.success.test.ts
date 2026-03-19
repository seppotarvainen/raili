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

// Access mocks after module resolution
const contextModule = require('../../src/context');

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
  contextModule.addStateToHistory.mockImplementation((ctx: any) => ctx);
  contextModule.getCurrentState.mockReturnValue(null);
});

test('persists success:true for terminal engine state', async () => {
  const engine = makeEngine({
    start: { id: 'start', config: { type: 'engine', success: true }, transitions: [] },
  });

  await engine.run();

  const calls = contextModule.addStateToHistory.mock.calls;
  expect(calls.some((c: any[]) => c[1] === 'start' && c[2] && c[2].success === true)).toBe(true);
  expect(contextModule.saveContext).toHaveBeenCalled();
});

test('persists success:null when success omitted for terminal engine state', async () => {
  const engine = makeEngine({
    start: { id: 'start', config: { type: 'engine' }, transitions: [] },
  });

  await engine.run();

  const calls = contextModule.addStateToHistory.mock.calls;
  expect(calls.some((c: any[]) => c[1] === 'start' && c[2] && c[2].success === null)).toBe(true);
  expect(contextModule.saveContext).toHaveBeenCalled();
});
