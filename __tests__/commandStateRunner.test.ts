import { runCommandState } from '../src/engine/CommandStateRunner';
import { StateDef } from '../src/types';
import * as outputStore from '../src/outputStore';

jest.mock('../src/outputStore');
jest.mock('../src/handlers/commandHandler');

const mockSave = outputStore.saveOutput as jest.MockedFunction<typeof outputStore.saveOutput>;
const { executeCommand } = require('../src/handlers/commandHandler');

describe('runCommandState', () => {
  beforeEach(() => jest.resetAllMocks());

  function makeState(overrides: Partial<StateDef['config']>): StateDef {
    return {
      id: 'test-state',
      config: { type: 'command', command: 'echo hello', ...overrides },
      transitions: [],
    };
  }

  describe('store_output', () => {
    test('saves stdout when store_output is true', async () => {
      executeCommand.mockResolvedValue({ success: true, stdout: 'test results', stderr: '' });
      await runCommandState(makeState({ store_output: true, on: { PASSED: 'next', FAILED: 'retry' } }), '/cwd');
      expect(mockSave).toHaveBeenCalledWith('/cwd', 'test-state', 'test results');
    });

    test('saves stderr when store_output is true and stderr has content', async () => {
      executeCommand.mockResolvedValue({ success: false, stdout: '', stderr: 'test summary' });
      await runCommandState(makeState({ store_output: true, on: { PASSED: 'next', FAILED: 'retry' } }), '/cwd');
      expect(mockSave).toHaveBeenCalledWith('/cwd', 'test-state', 'test summary');
    });

    test('saves combined stdout and stderr when both have content', async () => {
      executeCommand.mockResolvedValue({ success: true, stdout: 'stdout part', stderr: 'stderr part' });
      await runCommandState(makeState({ store_output: true, on: { PASSED: 'next', FAILED: 'retry' } }), '/cwd');
      const saved = mockSave.mock.calls[0][2];
      expect(saved).toContain('stdout part');
      expect(saved).toContain('stderr part');
    });

    test('does not save when store_output is false', async () => {
      executeCommand.mockResolvedValue({ success: true, stdout: 'test results', stderr: '' });
      await runCommandState(makeState({ store_output: false, on: { PASSED: 'next', FAILED: 'retry' } }), '/cwd');
      expect(mockSave).not.toHaveBeenCalled();
    });

    test('does not save output when store_output is omitted', async () => {
      executeCommand.mockResolvedValue({ success: true, stdout: 'test results', stderr: '' });
      await runCommandState(makeState({ on: { PASSED: 'next', FAILED: 'retry' } }), '/cwd');
      expect(mockSave).not.toHaveBeenCalled();
    });

    test('does not save when both stdout and stderr are empty', async () => {
      executeCommand.mockResolvedValue({ success: true, stdout: '', stderr: '' });
      await runCommandState(makeState({ store_output: true, on: { PASSED: 'next', FAILED: 'retry' } }), '/cwd');
      expect(mockSave).not.toHaveBeenCalled();
    });
  });

  describe('on: (exit code routing)', () => {
    test('returns PASSED when success is true', async () => {
      executeCommand.mockResolvedValue({ success: true, stdout: '', stderr: '' });
      const state = makeState({ on: { PASSED: 'next', FAILED: 'retry' } });
      expect(await runCommandState(state, '/cwd')).toBe('PASSED');
    });

    test('returns FAILED when success is false', async () => {
      executeCommand.mockResolvedValue({ success: false, stdout: '', stderr: '' });
      const state = makeState({ on: { PASSED: 'next', FAILED: 'retry' } });
      expect(await runCommandState(state, '/cwd')).toBe('FAILED');
    });
  });

  describe('transitions: (last stdout line routing)', () => {
    test('returns matching transition key from last stdout line', async () => {
      executeCommand.mockResolvedValue({ success: true, stdout: 'some output\ncommit_required\n', stderr: '' });
      const state = makeState({ transitions: { commit_required: 'commit', ready_for_archive: 'archive' } });
      expect(await runCommandState(state, '/cwd')).toBe('commit_required');
    });

    test('throws if last stdout line does not match any transition key', async () => {
      executeCommand.mockResolvedValue({ success: true, stdout: 'unknown_key\n', stderr: '' });
      const state = makeState({ transitions: { commit_required: 'commit' } });
      await expect(runCommandState(state, '/cwd')).rejects.toThrow("command output 'unknown_key' does not match any key");
    });

    test('throws if stdout is empty', async () => {
      executeCommand.mockResolvedValue({ success: true, stdout: '', stderr: '' });
      const state = makeState({ transitions: { commit_required: 'commit' } });
      await expect(runCommandState(state, '/cwd')).rejects.toThrow('command produced no output');
    });
  });

  describe('command execution', () => {
    test('passes command and cwd to executeCommand', async () => {
      executeCommand.mockResolvedValue({ success: true, stdout: '', stderr: '' });
      const state = makeState({ on: { PASSED: 'next', FAILED: 'retry' } });
      await runCommandState(state, '/cwd');
      expect(executeCommand).toHaveBeenCalledWith('echo hello', '/cwd');
    });

    test('uses directory override when specified', async () => {
      executeCommand.mockResolvedValue({ success: true, stdout: '', stderr: '' });
      const state = makeState({ directory: '/custom/dir', on: { PASSED: 'next', FAILED: 'retry' } });
      await runCommandState(state, '/cwd');
      expect(executeCommand).toHaveBeenCalledWith('echo hello', '/custom/dir');
    });

    test('falls back to cwd when directory is not specified', async () => {
      executeCommand.mockResolvedValue({ success: true, stdout: '', stderr: '' });
      const state = makeState({ on: { PASSED: 'next', FAILED: 'retry' } });
      await runCommandState(state, '/fallback');
      expect(executeCommand).toHaveBeenCalledWith('echo hello', '/fallback');
    });
  });
});

