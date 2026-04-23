import { Runner, RunnerConfig } from '../../../src/runner/runner';
import * as outputStore from '../../../src/context/outputStore';
import * as agentStateRunner from '../../../src/runner/agentStateRunner';
import * as scriptStateRunner from '../../../src/runner/scriptStateRunner';
import * as commandStateRunner from '../../../src/runner/commandStateRunner';
import * as learningStore from '../../../src/context/learningStore';
import * as manualHandler from '../../../src/handlers/manualHandler';
import * as approvalRunner from '../../../src/runner/approveStateRunner';

jest.mock('../../../src/context/outputStore');
jest.mock('../../../src/runner/agentStateRunner');
jest.mock('../../../src/runner/scriptStateRunner');
jest.mock('../../../src/runner/commandStateRunner');
jest.mock('../../../src/context/context', () => ({
  getCurrentState: jest.fn().mockReturnValue(null),
  addStateToHistory: jest.fn((ctx, stateId, meta) => ctx),
  saveContext: jest.fn(),
}));

jest.mock('../../../src/context/learningStore');
jest.mock('../../../src/handlers/manualHandler');
jest.mock('../../../src/runner/approveStateRunner');

const mockRunAgent = agentStateRunner.runAgentState as jest.MockedFunction<typeof agentStateRunner.runAgentState>;
const mockRunScript = scriptStateRunner.runScriptState as jest.MockedFunction<typeof scriptStateRunner.runScriptState>;
const mockRunCommand = commandStateRunner.runCommandState as jest.MockedFunction<typeof commandStateRunner.runCommandState>;
const mockAppend = learningStore.appendUniqueLearning as jest.MockedFunction<typeof learningStore.appendUniqueLearning>;
const mockHandleFeedback = manualHandler.handleFeedbackPrompt as jest.MockedFunction<typeof manualHandler.handleFeedbackPrompt>;
const mockRunApproval = approvalRunner.runApprovalStep as jest.MockedFunction<typeof approvalRunner.runApprovalStep>;

function makeRunner(states: any, initial = 'start', agentRegistry: any = { test_agent: { path: 'agent.md' }, 'raili-coding': { path: 'agent.md' } }): Runner {
  const stateMachine = { initial, states } as any;
  const context: any = { stateHistory: [] };
  return new Runner({
    stateMachine,
    agentRegistry,
    scriptRegistry: {},
    context,
    cwd: '/tmp',
  } as RunnerConfig);
}

beforeEach(() => {
  jest.resetAllMocks();
  mockRunAgent.mockResolvedValue({ outcome: 'PASSED' });
  mockRunScript.mockResolvedValue({ outcome: 'PASSED' });
  mockRunCommand.mockResolvedValue({ outcome: 'PASSED' });
  mockAppend.mockReturnValue(true);
});

test('teach appends learning from feedback-exposed variable', async () => {
  // feedback will return a value which should be stored as var 'note'
  mockHandleFeedback.mockResolvedValue('FEEDBACK_CONTENT');

  const runner = makeRunner({
    start: {
      id: 'start',
      config: {
        type: 'command',
        command: 'echo hi',
        feedback: { expose_var: 'note', question: 'Q' },
        teach: { test_agent: [{ var: '${note}' }] },
        on: { PASSED: 'done' },
      },
      transitions: ['done'],
    },
    done: { id: 'done', config: { type: 'engine' }, transitions: [] },
  });

  await runner.run();

  expect(mockAppend).toHaveBeenCalledWith('/tmp', 'test_agent', 'var:note', 'FEEDBACK_CONTENT', undefined, undefined);
});

test('teach appends learning from approval FAILED reason variable', async () => {
  // Instead of exercising the full approval flow here, start directly at the rework state
  // which declares a teach mapping that references the approval-failure var.

  const runner = makeRunner({
    start: { id: 'start', config: { type: 'engine' }, transitions: [] },
    rework: {
      id: 'rework',
      config: {
        type: 'engine',
        teach: { test_agent: [{ var: '${START_FAILED}' }] },
        on: { PASSED: 'start' },
      },
      transitions: [],
    },
  }, 'rework');

  // Simulate approval having already set the FAILED reason in context.vars
  (runner as any).context.vars = { START_FAILED: 'Bad reason' };

  await runner.run();

  expect(mockAppend).toHaveBeenCalledWith('/tmp', 'test_agent', 'var:START_FAILED', 'Bad reason', undefined, undefined);
});

test('teach appends learning from exposed variable produced by state', async () => {
  // Simulate a state that exports 'token'
  mockRunScript.mockResolvedValue({ outcome: 'PASSED', exports: { token: 'abc123' } } as any);

  const runner = makeRunner({
    start: {
      id: 'start',
      config: {
        type: 'script',
        script: 's',
        expose: ['token'],
        teach: { test_agent: [{ var: '${token}' }] },
        on: { PASSED: 'done' },
      },
      transitions: ['done'],
    },
    done: { id: 'done', config: { type: 'engine' }, transitions: [] },
  });

  await runner.run();

  expect(mockAppend).toHaveBeenCalledWith('/tmp', 'test_agent', 'var:token', 'abc123', undefined, undefined);
});

test('teach runs after approval and uses approval-failure var on same state', async () => {
  // Mock approval to return FAILED with a reason
  mockRunApproval.mockResolvedValue({ chosen: 'FAILED', target: 'rework', reason: 'Bad reason', question: 'Q' } as any);

  const runner = makeRunner({
    check_done: {
      id: 'check_done',
      config: {
        type: 'engine',
        approval: { PASSED: 'done', FAILED: 'rework', question: 'Q' },
        teach: { 'raili-coding': [{ var: '${CHECK_DONE_FAILED}' }] },
      },
      transitions: ['done'],
    },
    rework: { id: 'rework', config: { type: 'engine' }, transitions: [] },
    done: { id: 'done', config: { type: 'engine' }, transitions: [] },
  }, 'check_done');

  await runner.run();

  expect(mockAppend).toHaveBeenCalledWith('/tmp', 'raili-coding', 'var:CHECK_DONE_FAILED', 'Bad reason', undefined, undefined);
});

test('handleTeach throws when teach references unknown agent(s) and performs no learning writes', async () => {
  const runner = makeRunner({
    start: {
      id: 'start',
      config: {
        type: 'engine',
        teach: { unknown_agent: [{ var: '${X}' }] },
        on: { PASSED: 'done' },
      },
      transitions: ['done'],
    },
    done: { id: 'done', config: { type: 'engine' }, transitions: [] },
  }, 'start', {});

  await expect(runner.run()).rejects.toThrow(/unknown_agent/);
  expect(mockAppend).not.toHaveBeenCalled();
});
