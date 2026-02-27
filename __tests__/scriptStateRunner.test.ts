import { runScriptState } from '../src/engine/ScriptStateRunner';
import * as outputStore from '../src/outputStore';
import { StateDef } from '../src/types';

jest.mock('../src/outputStore');
jest.mock('../src/handlers/scriptHandler');

const mockSave = outputStore.saveOutput as jest.MockedFunction<typeof outputStore.saveOutput>;
const { executeScript } = require('../src/handlers/scriptHandler');

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

describe('store_output', () => {
  test('saves stdout when store_output is true', async () => {
    await runScriptState(makeState({ store_output: true }), {}, '/cwd');
    expect(mockSave).toHaveBeenCalledWith('/cwd', 'hello', 'script output');
  });

  test('saves stderr when only stderr has content', async () => {
    executeScript.mockResolvedValue({ success: false, stdout: '', stderr: 'script error' });
    await runScriptState(makeState({ store_output: true }), {}, '/cwd');
    expect(mockSave).toHaveBeenCalledWith('/cwd', 'hello', 'script error');
  });

  test('saves combined stdout and stderr when both have content', async () => {
    executeScript.mockResolvedValue({ success: true, stdout: 'out', stderr: 'err' });
    await runScriptState(makeState({ store_output: true }), {}, '/cwd');
    const saved = mockSave.mock.calls[0][2];
    expect(saved).toContain('out');
    expect(saved).toContain('err');
  });

  test('does not save output when store_output is false', async () => {
    await runScriptState(makeState({ store_output: false }), {}, '/cwd');
    expect(mockSave).not.toHaveBeenCalled();
  });

  test('does not save output when store_output is omitted', async () => {
    await runScriptState(makeState(), {}, '/cwd');
    expect(mockSave).not.toHaveBeenCalled();
  });

  test('does not save when both stdout and stderr are empty', async () => {
    executeScript.mockResolvedValue({ success: true, stdout: '', stderr: '' });
    await runScriptState(makeState({ store_output: true }), {}, '/cwd');
    expect(mockSave).not.toHaveBeenCalled();
  });
});

describe('on: routing', () => {
  test('returns PASSED on success', async () => {
    expect(await runScriptState(makeState(), {}, '/cwd')).toBe('PASSED');
  });

  test('returns FAILED on failure', async () => {
    executeScript.mockResolvedValue({ success: false, stdout: '', stderr: 'error' });
    expect(await runScriptState(makeState(), {}, '/cwd')).toBe('FAILED');
  });
});

