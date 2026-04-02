import { runAgentState } from '../../../src/runner/agentStateRunner';
import * as agentHandler from '../../../src/handlers/agentHandler';
import * as outputStore from '../../../src/context/outputStore';
import * as learningStore from '../../../src/context/learningStore';
import { StateDef } from '../../../src/types';

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
  mockExecuteAgent.mockResolvedValue({ success: true, stdout: 'agent output', stderr: '' });
  mockLoad.mockReturnValue(null);
  (learningStore.readLearningsForPrompt as jest.Mock).mockReturnValue('');
});

test('passes use_latest to executeAgent when configured', async () => {
  const outputConfig = { store: true, use_latest: 3 } as any;
  await runAgentState(makeState({ output: outputConfig }), registry, cwd);
  expect(mockExecuteAgent).toHaveBeenCalledWith(registry, 'coder', cwd, null, undefined, 3, undefined);
});

test('passes undefined when use_latest not configured', async () => {
  await runAgentState(makeState({ output: { store: true } as any }), registry, cwd);
  expect(mockExecuteAgent).toHaveBeenCalledWith(registry, 'coder', cwd, null, undefined, undefined, undefined);
});
