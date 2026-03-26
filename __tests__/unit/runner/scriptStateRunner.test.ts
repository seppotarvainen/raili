import {runScriptState} from '../../../src/runner/scriptStateRunner';
import * as outputStore from '../../../src/context/outputStore';
import {StateDef} from '../../../src/types';

jest.mock('../../../src/context/outputStore');
jest.mock('../../../src/handlers/scriptHandler');

const mockSave = outputStore.saveOutput as jest.MockedFunction<typeof outputStore.saveOutput>;
const { executeScript } = require('../../../src/handlers/scriptHandler');

function makeState(overrides: Partial<StateDef['config']> = {}): StateDef {
  return {
    id: 'hello',
    config: { type: 'script', script: 'hello', on: { PASSED: 'next', FAILED: 'retry' }, ...overrides },
    transitions: ['next', 'retry'],
  };
}

beforeEach(() => {
  jest.resetAllMocks();
  executeScript.mockResolvedValue({ success: true, stdout: 'script output', stderr: '' });
});

describe('output', () => {
  test('saves stdout when output store is true', async () => {
    const outputConfig = { store: true };
    await runScriptState(makeState({ output: outputConfig }), {}, '/cwd');
    expect(mockSave).toHaveBeenCalledWith('/cwd', 'hello', 'script output', outputConfig, undefined);
  });

  test('saves stderr when only stderr has content', async () => {
    executeScript.mockResolvedValue({ success: false, stdout: '', stderr: 'script error' });
    const outputConfig = { store: true };
    await runScriptState(makeState({ output: outputConfig }), {}, '/cwd');
    expect(mockSave).toHaveBeenCalledWith('/cwd', 'hello', 'script error', outputConfig, undefined);
  });

  test('saves combined stdout and stderr when both have content', async () => {
    executeScript.mockResolvedValue({ success: true, stdout: 'out', stderr: 'err' });
    const outputConfig = { store: true };
    await runScriptState(makeState({ output: outputConfig }), {}, '/cwd');
    const saved = mockSave.mock.calls[0][2];
    expect(saved).toContain('out');
    expect(saved).toContain('err');
  });

  test('does not save output when output is omitted', async () => {
    await runScriptState(makeState({}), {}, '/cwd');
    expect(mockSave).not.toHaveBeenCalled();
  });

  test('does not save output when output config is omitted', async () => {
    await runScriptState(makeState(), {}, '/cwd');
    expect(mockSave).not.toHaveBeenCalled();
  });

  test('does not save when both stdout and stderr are empty', async () => {
    executeScript.mockResolvedValue({ success: true, stdout: '', stderr: '' });
    const outputConfig = { store: true };
    await runScriptState(makeState({ output: outputConfig }), {}, '/cwd');
    expect(mockSave).not.toHaveBeenCalled();
  });
});

describe('on: routing', () => {
  test('returns PASSED on success', async () => {
    expect((await runScriptState(makeState(), {}, '/cwd')).outcome).toBe('PASSED');
  });

  test('returns FAILED on failure', async () => {
    executeScript.mockResolvedValue({ success: false, stdout: '', stderr: 'error' });
    expect((await runScriptState(makeState(), {}, '/cwd')).outcome).toBe('FAILED');
  });
});

describe('args forwarding', () => {
  test('forwards args from state.config to executeScript', async () => {
    const state = makeState({ args: ['one', 'two'] });
    const registry = {};
    await runScriptState(state, registry, '/cwd');
    expect(executeScript).toHaveBeenCalledWith(registry, 'hello', '/cwd', ['one', 'two'], {});
  });
});

