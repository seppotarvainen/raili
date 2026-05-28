import {runAgentState} from '../../../src/runner/agentStateRunner';
import * as agentHandler from '../../../src/handlers/agentHandler';
import * as outputStore from '../../../src/context/outputStore';
import {StateDef, TokenUsage} from '../../../src/types';
import * as learningStore from '../../../src/context/learningStore';

jest.mock('../../../src/handlers/agentHandler');
jest.mock('../../../src/context/outputStore');
jest.mock('../../../src/context/learningStore');

const mockExecuteAgent = agentHandler.executeAgent as jest.MockedFunction<typeof agentHandler.executeAgent>;
const mockLoad = outputStore.loadAgentOutputPath as jest.MockedFunction<typeof outputStore.loadAgentOutputPath>;

const registry = {};
const cwd = '/tmp';

function makeState(overrides: Partial<StateDef['config']> = {}): StateDef {
  return {
    id: 'code',
    config: { type: 'agent', agent: 'coder', on: { PASSED: 'done', FAILED: 'code' }, ...overrides },
    transitions: ['done', 'code'],
  };
}

beforeEach(() => {
  jest.resetAllMocks();
  mockLoad.mockReturnValue(null);
  (learningStore.readMergedLearningsForPrompt as jest.Mock).mockReturnValue('');
});

test('forwards tokens from executeAgent into StateResult', async () => {
  const tokens: TokenUsage = { input: 10, output: 5 };
  mockExecuteAgent.mockResolvedValue({ success: true, stdout: 'agent output', stderr: '', tokens });

  const result = await runAgentState(makeState(), registry, cwd);
  expect(result.tokens).toEqual(tokens);
});
