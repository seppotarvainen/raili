import {buildStateMachine, validateStateMachine} from '../../../src/workflow/workflowLoader';
import {Runner} from '../../../src/runner/Runner';
import * as outputStore from '../../../src/context/outputStore';
import * as notifyHandler from '../../../src/handlers/notifyHandler';
import * as agentStateRunner from '../../../src/runner/agentStateRunner';
import * as scriptStateRunner from '../../../src/runner/ScriptStateRunner';
import * as commandStateRunner from '../../../src/runner/CommandStateRunner';
import {StateMachine, WorkflowContext} from '../../../src/types';

jest.mock('../../../src/context/outputStore');
jest.mock('../../../src/handlers/notifyHandler');
jest.mock('../../../src/runner/agentStateRunner');
jest.mock('../../../src/runner/ScriptStateRunner');
jest.mock('../../../src/runner/CommandStateRunner');
jest.mock('../../../src/context/context', () => ({
  getCurrentState: jest.fn().mockReturnValue(null),
  addStateToHistory: jest.fn((ctx) => ctx),
  saveContext: jest.fn(),
}));

const mockClear = outputStore.clearAgentOutputs as jest.MockedFunction<typeof outputStore.clearAgentOutputs>;
const mockRunAgent = agentStateRunner.runAgentState as jest.MockedFunction<typeof agentStateRunner.runAgentState>;
const mockRunScript = scriptStateRunner.runScriptState as jest.MockedFunction<typeof scriptStateRunner.runScriptState>;
const mockRunCommand = commandStateRunner.runCommandState as jest.MockedFunction<typeof commandStateRunner.runCommandState>;

function makeEngine(states: StateMachine['states'], initial = 'start'): Runner {
  const stateMachine: StateMachine = { initial, states };
  const context: WorkflowContext = { stateHistory: [] };
  return new Runner({
    stateMachine,
    agentRegistry: {},
    scriptRegistry: {},
    context,
    cwd: '/tmp',
  } as any);
}

beforeEach(() => {
  jest.resetAllMocks();
  (notifyHandler.runNotify as jest.Mock).mockResolvedValue(undefined);
  mockRunAgent.mockResolvedValue({ outcome: 'PASSED' } as any);
  mockRunScript.mockResolvedValue({ outcome: 'PASSED' } as any);
  mockRunCommand.mockResolvedValue({ outcome: 'PASSED' } as any);
});

describe('skip feature', () => {
  test('buildStateMachine includes skip target in transitions for validation', () => {
    const config = {
      initial: 'start',
      states: {
        start: { type: 'engine' as const, skip: 'b' as any },
        b: { type: 'engine' as const },
      },
    } as any;

    const machine = buildStateMachine(config);
    expect(machine.states.start.transitions).toContain('b');
  });

  test('validateStateMachine throws when skip target missing', () => {
    const config = {
      initial: 'start',
      states: {
        start: { type: 'engine' as const, skip: 'ghost' as any },
      },
    } as any;

    const machine = buildStateMachine(config);
    expect(() => validateStateMachine(machine)).toThrow(/transition to unknown state 'ghost'/);
  });

  test('engine bypasses skipped state and does not invoke handlers or notify', async () => {
    const engine = makeEngine({
      start: {
        id: 'start',
        config: { type: 'command', command: 'echo skip', skip: 'b' as any },
        transitions: ['b'],
      },
      b: {
        id: 'b',
        config: { type: 'command', command: 'echo run', on: { PASSED: 'done' } },
        transitions: ['done'],
      },
      done: { id: 'done', config: { type: 'engine' }, transitions: [] },
    });

    await engine.run();

    // start is skipped — runCommand should only be invoked for 'b'
    expect(mockRunCommand).toHaveBeenCalledTimes(1);
    // skipped state should not clear outputs or run notify
    expect(mockClear).not.toHaveBeenCalled();
    expect((notifyHandler.runNotify as jest.Mock).mock.calls.length).toBeLessThanOrEqual(1);
  });

  test('engine records skip action in state history meta', async () => {
    const ctx = require('../../../src/context/context');
    const engine = makeEngine({
      start: {
        id: 'start',
        config: { type: 'command', command: 'echo skip', skip: 'b' as any },
        transitions: ['b'],
      },
      b: {
        id: 'b',
        config: { type: 'command', command: 'echo run', on: { PASSED: 'done' } },
        transitions: ['done'],
      },
      done: { id: 'done', config: { type: 'engine' }, transitions: [] },
    });

    await engine.run();

    // Verify addStateToHistory was called with meta containing skipped target for 'start'
    const calls = (ctx.addStateToHistory as jest.Mock).mock.calls;
    const skipCall = calls.find((c: any) => c[1] === 'start' && c[2] && c[2].skipped && c[2].skipped.target === 'b');
    expect(skipCall).toBeDefined();
  });
});
