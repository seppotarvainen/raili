import {runCommandState} from '../../../src/runner/CommandStateRunner';
import {StateDef} from '../../../src/types';
import * as outputStore from '../../../src/context/outputStore';

jest.mock('../../../src/context/outputStore');
jest.mock('../../../src/handlers/commandHandler');

const mockSave = outputStore.saveOutput as jest.MockedFunction<typeof outputStore.saveOutput>;
const { executeCommand } = require('../../../src/handlers/commandHandler');

describe('runCommandState', () => {
  beforeEach(() => jest.resetAllMocks());

  function makeState(overrides: Partial<StateDef['config']>): StateDef {
    return {
      id: 'test-state',
      config: { type: 'command', command: 'echo hello', ...overrides },
      transitions: [],
    };
  }

  describe('output', () => {
    test('saves stdout when output store is true', async () => {
      executeCommand.mockResolvedValue({ success: true, stdout: 'test results', stderr: '' });
      const outputConfig = { store: true };
      await runCommandState(makeState({ output: outputConfig, on: { PASSED: 'next', FAILED: 'retry' } }), '/cwd');
      expect(mockSave).toHaveBeenCalledWith('/cwd', 'test-state', 'test results', outputConfig, undefined);
    });

    test('saves stderr when output store is true and stderr has content', async () => {
      executeCommand.mockResolvedValue({ success: false, stdout: '', stderr: 'test summary' });
      const outputConfig = { store: true };
      await runCommandState(makeState({ output: outputConfig, on: { PASSED: 'next', FAILED: 'retry' } }), '/cwd');
      expect(mockSave).toHaveBeenCalledWith('/cwd', 'test-state', 'test summary', outputConfig, undefined);
    });

    test('saves combined stdout and stderr when both have content', async () => {
      executeCommand.mockResolvedValue({ success: true, stdout: 'stdout part', stderr: 'stderr part' });
      const outputConfig = { store: true };
      await runCommandState(makeState({ output: outputConfig, on: { PASSED: 'next', FAILED: 'retry' } }), '/cwd');
      const saved = mockSave.mock.calls[0][2];
      expect(saved).toContain('stdout part');
      expect(saved).toContain('stderr part');
    });

    test('does not save when output is omitted', async () => {
      executeCommand.mockResolvedValue({ success: true, stdout: 'test results', stderr: '' });
      await runCommandState(makeState({ on: { PASSED: 'next', FAILED: 'retry' } }), '/cwd');
      expect(mockSave).not.toHaveBeenCalled();
    });

    test('does not save output when output config is omitted', async () => {
      executeCommand.mockResolvedValue({ success: true, stdout: 'test results', stderr: '' });
      await runCommandState(makeState({ on: { PASSED: 'next', FAILED: 'retry' } }), '/cwd');
      expect(mockSave).not.toHaveBeenCalled();
    });

    test('does not save when both stdout and stderr are empty', async () => {
      executeCommand.mockResolvedValue({ success: true, stdout: '', stderr: '' });
      const outputConfig = { store: true };
      await runCommandState(makeState({ output: outputConfig, on: { PASSED: 'next', FAILED: 'retry' } }), '/cwd');
      expect(mockSave).not.toHaveBeenCalled();
    });
  });

  describe('on: (exit code routing)', () => {
    test('returns PASSED when success is true', async () => {
      executeCommand.mockResolvedValue({ success: true, stdout: '', stderr: '' });
      const state = makeState({ on: { PASSED: 'next', FAILED: 'retry' } });
      expect((await runCommandState(state, '/cwd')).outcome).toBe('PASSED');
    });

    test('returns FAILED when success is false', async () => {
      executeCommand.mockResolvedValue({ success: false, stdout: '', stderr: '' });
      const state = makeState({ on: { PASSED: 'next', FAILED: 'retry' } });
      expect((await runCommandState(state, '/cwd')).outcome).toBe('FAILED');
    });
  });

  describe('transitions: (last stdout line routing)', () => {
    test('returns matching transition key from last stdout line', async () => {
      executeCommand.mockResolvedValue({ success: true, stdout: 'some output\ncommit_required\n', stderr: '' });
      const state = makeState({ transitions: { commit_required: 'commit', ready_for_archive: 'archive' } });
      expect((await runCommandState(state, '/cwd')).outcome).toBe('commit_required');
    });

    test('returns unknown transition key when last stdout line does not match any transition key (engine will apply default)', async () => {
      executeCommand.mockResolvedValue({ success: true, stdout: 'unknown_key\n', stderr: '' });
      const state = makeState({ transitions: { commit_required: 'commit', default: 'done' } });
      expect((await runCommandState(state, '/cwd')).outcome).toBe('unknown_key');
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
      expect(executeCommand).toHaveBeenCalledWith('echo hello', '/cwd', {});
    });

    test('uses directory override when specified', async () => {
      executeCommand.mockResolvedValue({ success: true, stdout: '', stderr: '' });
      const state = makeState({ directory: '/custom/dir', on: { PASSED: 'next', FAILED: 'retry' } });
      await runCommandState(state, '/cwd');
      expect(executeCommand).toHaveBeenCalledWith('echo hello', '/custom/dir', {});
    });

    test('falls back to cwd when directory is not specified', async () => {
      executeCommand.mockResolvedValue({ success: true, stdout: '', stderr: '' });
      const state = makeState({ on: { PASSED: 'next', FAILED: 'retry' } });
      await runCommandState(state, '/fallback');
      expect(executeCommand).toHaveBeenCalledWith('echo hello', '/fallback', {});
    });
  });
});

