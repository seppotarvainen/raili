import {Engine, EngineConfig} from '../../src/engine/Engine';
import * as outputStore from '../../src/outputStore';
import * as notifyHandler from '../../src/handlers/notifyHandler';
import * as commandStateRunner from '../../src/engine/CommandStateRunner';
import {WorkflowContext} from '../../src/types';

jest.mock('../../src/outputStore');
jest.mock('../../src/handlers/notifyHandler');
jest.mock('../../src/engine/CommandStateRunner');

// mock context helpers so we can assert they were called correctly
jest.mock('../../src/context', () => ({
  getCurrentState: jest.fn().mockReturnValue(null),
  addStateToHistory: jest.fn((ctx, state) => ctx),
  saveContext: jest.fn(),
}));

const mockClear = outputStore.clearAgentOutputs as jest.MockedFunction<typeof outputStore.clearAgentOutputs>;
const mockNotify = notifyHandler.runNotify as jest.MockedFunction<typeof notifyHandler.runNotify>;
const mockRunCommand = commandStateRunner.runCommandState as jest.MockedFunction<typeof commandStateRunner.runCommandState>;
const { addStateToHistory } = require('../../src/context');

test('routes to declared error state on unhandled exception and runs entry actions', async () => {
  // Arrange: command runner throws
  mockRunCommand.mockImplementation(async () => { throw new Error('boom'); });

  const states = {
    start: {
      id: 'start',
      config: { type: 'command', command: 'exit 1', on: { PASSED: 'done' } },
      transitions: [],
    },
    error_state: {
      id: 'error_state',
      config: { type: 'engine', notify: 'echo error', reset_outputs: ['a'] },
      transitions: [],
    }
  };

  const machine = { initial: 'start', error: 'error_state', states } as any;
  const context: WorkflowContext = { stateHistory: [] };
  const engine = new Engine({ stateMachine: machine, agentRegistry: {}, scriptRegistry: {}, context, cwd: '/tmp' } as EngineConfig);

  // Act
  await expect(engine.run()).resolves.not.toThrow();

  // Assert: entry actions for error state were executed
  expect(mockClear).toHaveBeenCalledWith('/tmp', ['a']);
  expect(mockNotify).toHaveBeenCalledWith('echo error', '/tmp');

  // addStateToHistory should have been called to record the error state entry
  expect(addStateToHistory).toHaveBeenCalled();
  const calls = (addStateToHistory as jest.Mock).mock.calls;
  const found = calls.some((c: any[]) => c[1] === 'error_state');
  expect(found).toBe(true);
});
