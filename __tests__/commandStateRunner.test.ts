import { runCommandState } from '../src/engine/CommandStateRunner';
import { StateDef } from '../src/types';

function makeState(overrides: Partial<StateDef['config']>): StateDef {
  return {
    id: 'test-state',
    config: { type: 'command', command: 'echo hello', ...overrides },
    transitions: [],
  };
}

jest.mock('../src/handlers/commandHandler');
const { executeCommand } = require('../src/handlers/commandHandler');

describe('runCommandState', () => {
  beforeEach(() => jest.resetAllMocks());

  describe('on: (exit code routing)', () => {
    test('returns PASSED when success is true', () => {
      executeCommand.mockReturnValue({ success: true, output: '' });
      const state = makeState({ on: { PASSED: 'next', FAILED: 'retry' } });
      expect(runCommandState(state, '/cwd')).toBe('PASSED');
    });

    test('returns FAILED when success is false', () => {
      executeCommand.mockReturnValue({ success: false, output: '' });
      const state = makeState({ on: { PASSED: 'next', FAILED: 'retry' } });
      expect(runCommandState(state, '/cwd')).toBe('FAILED');
    });
  });

  describe('transitions: (last stdout line routing)', () => {
    test('returns matching transition key from last stdout line', () => {
      executeCommand.mockReturnValue({ success: true, output: 'some output\ncommit_required\n' });
      const state = makeState({ transitions: { commit_required: 'commit', ready_for_archive: 'archive' } });
      expect(runCommandState(state, '/cwd')).toBe('commit_required');
    });

    test('throws if last stdout line does not match any transition key', () => {
      executeCommand.mockReturnValue({ success: true, output: 'unknown_key\n' });
      const state = makeState({ transitions: { commit_required: 'commit' } });
      expect(() => runCommandState(state, '/cwd')).toThrow("command output 'unknown_key' does not match any key");
    });

    test('throws if stdout is empty', () => {
      executeCommand.mockReturnValue({ success: true, output: '' });
      const state = makeState({ transitions: { commit_required: 'commit' } });
      expect(() => runCommandState(state, '/cwd')).toThrow('command produced no output');
    });
  });

  describe('command execution', () => {
    test('passes command and cwd to executeCommand', () => {
      executeCommand.mockReturnValue({ success: true, output: '' });
      const state = makeState({ on: { PASSED: 'next', FAILED: 'retry' } });
      runCommandState(state, '/cwd');
      expect(executeCommand).toHaveBeenCalledWith('echo hello', '/cwd');
    });

    test('uses directory override when specified', () => {
      executeCommand.mockReturnValue({ success: true, output: '' });
      const state = makeState({ directory: '/custom/dir', on: { PASSED: 'next', FAILED: 'retry' } });
      runCommandState(state, '/cwd');
      expect(executeCommand).toHaveBeenCalledWith('echo hello', '/custom/dir');
    });

    test('falls back to cwd when directory is not specified', () => {
      executeCommand.mockReturnValue({ success: true, output: '' });
      const state = makeState({ on: { PASSED: 'next', FAILED: 'retry' } });
      runCommandState(state, '/fallback');
      expect(executeCommand).toHaveBeenCalledWith('echo hello', '/fallback');
    });
  });
});

