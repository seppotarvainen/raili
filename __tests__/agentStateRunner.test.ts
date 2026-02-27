import { runAgentState } from '../src/engine/AgentStateRunner';
import * as agentHandler from '../src/handlers/agentHandler';
import * as outputStore from '../src/agentOutputStore';
import { StateDef } from '../src/types';

jest.mock('../src/handlers/agentHandler');
jest.mock('../src/agentOutputStore');

const mockExecuteAgent = agentHandler.executeAgent as jest.MockedFunction<typeof agentHandler.executeAgent>;
const mockSave = outputStore.saveAgentOutput as jest.MockedFunction<typeof outputStore.saveAgentOutput>;
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
  mockExecuteAgent.mockResolvedValue({ success: true, output: 'agent output' });
  mockLoad.mockReturnValue(null);
});

test('passes previous output path to executeAgent when available', async () => {
  mockLoad.mockReturnValue('/tmp/.raili/outputs/code.md');
  await runAgentState(makeState(), registry, cwd);
  expect(mockExecuteAgent).toHaveBeenCalledWith(registry, 'coder', cwd, '/tmp/.raili/outputs/code.md');
});

test('passes null to executeAgent when no previous output exists', async () => {
  mockLoad.mockReturnValue(null);
  await runAgentState(makeState(), registry, cwd);
  expect(mockExecuteAgent).toHaveBeenCalledWith(registry, 'coder', cwd, null);
});

test('saves output when store_output is true', async () => {
  await runAgentState(makeState({ store_output: true, on: { PASSED: 'done', FAILED: 'code' } }), registry, cwd);
  expect(mockSave).toHaveBeenCalledWith(cwd, 'code', 'agent output');
});

test('does not save output when store_output is false', async () => {
  await runAgentState(makeState({ store_output: false, on: { PASSED: 'done', FAILED: 'code' } }), registry, cwd);
  expect(mockSave).not.toHaveBeenCalled();
});

test('does not save output when store_output is omitted', async () => {
  await runAgentState(makeState(), registry, cwd);
  expect(mockSave).not.toHaveBeenCalled();
});

test('does not save output when agent produces no output', async () => {
  mockExecuteAgent.mockResolvedValue({ success: true, output: '' });
  await runAgentState(makeState({ store_output: true, on: { PASSED: 'done', FAILED: 'code' } }), registry, cwd);
  expect(mockSave).not.toHaveBeenCalled();
});


test('returns PASSED on success with on: block', async () => {
  const outcome = await runAgentState(makeState(), registry, cwd);
  expect(outcome).toBe('PASSED');
});

test('returns FAILED on failure with on: block', async () => {
  mockExecuteAgent.mockResolvedValue({ success: false, output: 'error' });
  const outcome = await runAgentState(makeState(), registry, cwd);
  expect(outcome).toBe('FAILED');
});

