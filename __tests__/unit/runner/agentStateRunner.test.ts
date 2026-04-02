import {runAgentState} from '../../../src/runner/agentStateRunner';
import * as agentHandler from '../../../src/handlers/agentHandler';
import * as outputStore from '../../../src/context/outputStore';
import {StateDef} from '../../../src/types';
import * as learningStore from '../../../src/context/learningStore';

jest.mock('../../../src/handlers/agentHandler');
jest.mock('../../../src/context/outputStore');
jest.mock('../../../src/context/learningStore');

const mockExecuteAgent = agentHandler.executeAgent as jest.MockedFunction<typeof agentHandler.executeAgent>;
const mockSave = outputStore.saveOutput as jest.MockedFunction<typeof outputStore.saveOutput>;
const mockLoad = outputStore.loadAgentOutputPath as jest.MockedFunction<typeof outputStore.loadAgentOutputPath>;
const mockReadLatest = outputStore.readLatestRun as jest.MockedFunction<typeof outputStore.readLatestRun>;

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
  mockReadLatest.mockReturnValue(null);
  (learningStore.readLearningsForPrompt as jest.Mock).mockReturnValue('');
  (learningStore.appendUniqueLearning as jest.Mock).mockReturnValue(true);
});

test('passes previous output path to executeAgent when available', async () => {
  mockLoad.mockReturnValue('/tmp/.raili/outputs/code.md');
  await runAgentState(makeState(), registry, cwd);
  expect(mockExecuteAgent).toHaveBeenCalledWith(registry, 'coder', cwd, '/tmp/.raili/outputs/code.md', undefined, undefined, undefined);
});

test('passes null to executeAgent when no previous output exists', async () => {
  mockLoad.mockReturnValue(null);
  await runAgentState(makeState(), registry, cwd);
  expect(mockExecuteAgent).toHaveBeenCalledWith(registry, 'coder', cwd, null, undefined, undefined, undefined);
});

test('forwards state prompt to executeAgent', async () => {
  await runAgentState(makeState({ prompt: 'Analyze $RAILI_VAR_TICKET_ID' }), registry, cwd);
  expect(mockExecuteAgent).toHaveBeenCalledWith(registry, 'coder', cwd, null, 'Analyze $RAILI_VAR_TICKET_ID', undefined, undefined);
});

test('saves output when output config store is true', async () => {
  const outputConfig = { store: true };
  await runAgentState(makeState({ output: outputConfig, on: { PASSED: 'done', FAILED: 'code' } }), registry, cwd);
  expect(mockSave).toHaveBeenCalledWith(cwd, 'code', 'agent output', outputConfig, undefined);
});

test('does not save output when output config is omitted', async () => {
  await runAgentState(makeState(), registry, cwd);
  expect(mockSave).not.toHaveBeenCalled();
});

test('does not save output when agent produces no output', async () => {
  mockExecuteAgent.mockResolvedValue({ success: true, stdout: '', stderr: '' });
  const outputConfig = { store: true };
  await runAgentState(makeState({ output: outputConfig, on: { PASSED: 'done', FAILED: 'code' } }), registry, cwd);
  expect(mockSave).not.toHaveBeenCalled();
});

test('returns PASSED on success with on: block', async () => {
  const result = await runAgentState(makeState(), registry, cwd);
  expect(result.outcome).toBe('PASSED');
});

test('returns FAILED on failure with on: block', async () => {
  mockExecuteAgent.mockResolvedValue({ success: false, stdout: '', stderr: 'error' });
  const result = await runAgentState(makeState(), registry, cwd);
  expect(result.outcome).toBe('FAILED');
});



test('throws when transitions state and agent produces no output', async () => {
  mockExecuteAgent.mockResolvedValue({ success: true, stdout: '', stderr: '' });
  const state = makeState({ transitions: { approve: 'done', reject: 'code' }, on: undefined });
  await expect(runAgentState(state, registry, cwd)).rejects.toThrow(/no output/);
});

test('returns last stdout line as outcome when transitions configured', async () => {
  mockExecuteAgent.mockResolvedValue({ success: true, stdout: 'some work\napprove', stderr: '' });
  const state = makeState({ transitions: { approve: 'done', reject: 'code' }, on: undefined });
  const result = await runAgentState(state, registry, cwd);
  expect(result.outcome).toBe('approve');
});

