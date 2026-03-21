import {resolveTransition} from '../../src/runner/transition';

test('resolves direct mapping', () => {
  const transitions = { PASSED: 'verify', FAILED: 'failed' };
  expect(resolveTransition(transitions, 'PASSED')).toBe('verify');
  expect(resolveTransition(transitions, 'FAILED')).toBe('failed');
});

test('resolves case-insensitively and fallback default', () => {
  const transitions = { passed: 'verify', default: 'failed' };
  expect(resolveTransition(transitions, 'PASSED')).toBe('verify');
  expect(resolveTransition(transitions, 'UNKNOWN')).toBe('failed');
});

test('returns null when no mapping', () => {
  expect(resolveTransition(null as any, 'PASSED')).toBeNull();
});
