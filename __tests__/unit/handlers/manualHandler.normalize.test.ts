import { normalizeApprovalResult, normalizeFeedbackResult } from '../../../src/handlers/manualHandler';

describe('manualHandler normalization adapters', () => {
  describe('normalizeApprovalResult', () => {
    test('accepts old string PASSED', () => {
      expect(normalizeApprovalResult('PASSED')).toEqual({ outcome: 'PASSED' });
    });

    test('accepts old string FAILED', () => {
      expect(normalizeApprovalResult('FAILED')).toEqual({ outcome: 'FAILED' });
    });

    test('accepts new object with reason', () => {
      expect(normalizeApprovalResult({ outcome: 'FAILED', reason: 'Needs more tests' })).toEqual({ outcome: 'FAILED', reason: 'Needs more tests' });
    });

    test('throws on invalid value', () => {
      expect(() => normalizeApprovalResult('UNKNOWN')).toThrow();
    });
  });

  describe('normalizeFeedbackResult', () => {
    test('accepts old string', () => {
      expect(normalizeFeedbackResult('Looks good')).toEqual({ feedback: 'Looks good' });
    });

    test('accepts new object with metadata', () => {
      expect(normalizeFeedbackResult({ feedback: 'Fine', metadata: 'auto' })).toEqual({ feedback: 'Fine', metadata: 'auto' });
    });

    test('accepts null as null', () => {
      expect(normalizeFeedbackResult(null)).toBeNull();
    });

    test('throws on invalid object', () => {
      expect(() => normalizeFeedbackResult({ bad: true as any })).toThrow();
    });
  });
});
