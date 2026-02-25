import { runCommandState } from '../src/engine/CommandStateRunner';
import { StateDef } from '../src/types';

function makeState(overrides: Partial<StateDef['config']>): StateDef {
  return {
    id: 'test-state',
    config: { type: 'command', command: 'echo hello', ...overrides },
    transitions: [],
  };
}

// Mock spawnSync so no real shell commands are executed
jest.mock('child_process', () => ({
  spawnSync: jest.fn(),
}));

const { spawnSync } = require('child_process');

describe('runCommandState', () => {
  beforeEach(() => jest.resetAllMocks());

  describe('on: (exit code routing)', () => {
    test('returns PASSED when exit code is 0', () => {
      spawnSync.mockReturnValue({ status: 0, stdout: '', stderr: '', error: undefined });
      const state = makeState({ on: { PASSED: 'next', FAILED: 'retry' } });
      expect(runCommandState(state, '/cwd')).toBe('PASSED');
    });

    test('returns FAILED when exit code is non-zero', () => {
      spawnSync.mockReturnValue({ status: 1, stdout: '', stderr: '', error: undefined });
      const state = makeState({ on: { PASSED: 'next', FAILED: 'retry' } });
      expect(runCommandState(state, '/cwd')).toBe('FAILED');
    });

    test('returns FAILED when spawnSync reports an error', () => {
      spawnSync.mockReturnValue({ status: 0, stdout: '', stderr: '', error: new Error('spawn failed') });
      const state = makeState({ on: { PASSED: 'next', FAILED: 'retry' } });
      expect(runCommandState(state, '/cwd')).toBe('FAILED');
    });
  });

  describe('transitions: (last stdout line routing)', () => {
    test('returns matching transition key from last stdout line', () => {
      spawnSync.mockReturnValue({ status: 0, stdout: 'some output\ncommit_required\n', stderr: '', error: undefined });
      const state = makeState({ transitions: { commit_required: 'commit', ready_for_archive: 'archive' } });
      expect(runCommandState(state, '/cwd')).toBe('commit_required');
    });

    test('throws if last stdout line does not match any transition key', () => {
      spawnSync.mockReturnValue({ status: 0, stdout: 'unknown_key\n', stderr: '', error: undefined });
      const state = makeState({ transitions: { commit_required: 'commit' } });
      expect(() => runCommandState(state, '/cwd')).toThrow("command output 'unknown_key' does not match any key");
    });

    test('throws if stdout is empty', () => {
      spawnSync.mockReturnValue({ status: 0, stdout: '', stderr: '', error: undefined });
      const state = makeState({ transitions: { commit_required: 'commit' } });
      expect(() => runCommandState(state, '/cwd')).toThrow('command produced no output');
    });
  });

  describe('command execution', () => {
    test('runs command via sh -c', () => {
      spawnSync.mockReturnValue({ status: 0, stdout: '', stderr: '', error: undefined });
      const state = makeState({ on: { PASSED: 'next', FAILED: 'retry' } });
      runCommandState(state, '/cwd');
      expect(spawnSync).toHaveBeenCalledWith('sh', ['-c', 'echo hello'], expect.objectContaining({ cwd: '/cwd' }));
    });

    test('uses directory override when specified', () => {
      spawnSync.mockReturnValue({ status: 0, stdout: '', stderr: '', error: undefined });
      const state = makeState({ directory: '/custom/dir', on: { PASSED: 'next', FAILED: 'retry' } });
      runCommandState(state, '/cwd');
      expect(spawnSync).toHaveBeenCalledWith('sh', ['-c', 'echo hello'], expect.objectContaining({ cwd: '/custom/dir' }));
    });

    test('falls back to cwd when directory is not specified', () => {
      spawnSync.mockReturnValue({ status: 0, stdout: '', stderr: '', error: undefined });
      const state = makeState({ on: { PASSED: 'next', FAILED: 'retry' } });
      runCommandState(state, '/fallback');
      expect(spawnSync).toHaveBeenCalledWith('sh', ['-c', 'echo hello'], expect.objectContaining({ cwd: '/fallback' }));
    });
  });
});

