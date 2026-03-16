jest.mock('../../src/engine/ScriptStateRunner');
jest.mock('../../src/context');
jest.mock('../../src/handlers/notifyHandler');
jest.mock('../../src/outputStore');

import { Engine } from '../../src/engine/Engine';
import { runScriptState } from '../../src/engine/ScriptStateRunner';
import { addStateToHistory, saveContext, getCurrentState } from '../../src/context';

const mockRunScript = runScriptState as jest.MockedFunction<any>;
const mockAddState = addStateToHistory as jest.MockedFunction<any>;
const mockSave = saveContext as jest.MockedFunction<any>;
const mockGetCurrent = getCurrentState as jest.MockedFunction<any>;

beforeEach(() => {
  jest.resetAllMocks();
});

test('Engine routes to error state when expose missing', async () => {
  // Mock runScriptState to return no exports
  mockRunScript.mockResolvedValue({ outcome: 'PASSED', exports: {} });

  // Simple state machine: start -> done; error state present
  const stateMachine: any = {
    initial: 'start',
    error: 'error',
    states: {
      start: { id: 'start', config: { type: 'script', script: 'gen', expose: ['id'], on: { PASSED: 'done' } } },
      done: { id: 'done', config: { type: 'engine' } },
      error: { id: 'error', config: { type: 'engine' } },
    }
  };

  // Mock context helpers: getCurrentState returns null initially
  mockGetCurrent.mockReturnValue(null);
  mockAddState.mockImplementation((ctx, stateId) => ({ ...ctx, stateHistory: [...(ctx.stateHistory||[]), { state: stateId, enteredAt: new Date().toISOString() }] }));
  mockSave.mockImplementation(() => {});

  const engine = new Engine({ stateMachine, agentRegistry: {}, scriptRegistry: {}, context: { stateHistory: [] }, cwd: process.cwd() });

  await engine.run();

  // Expect that the engine recorded the error state into context via addStateToHistory
  expect(mockAddState).toHaveBeenCalled();
  // The last call should be routing to the error state
  const calls = (mockAddState.mock.calls as any[][]).map(c => c[1]);
  expect(calls).toContain('error');
});
