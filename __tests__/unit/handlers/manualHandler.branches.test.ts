import {
  normalizeApprovalResult,
  normalizeFeedbackResult,
  loadApprovalResolver,
  handleManualTransition,
  handleFeedbackPrompt,
} from '../../../src/handlers/manualHandler';

afterEach(() => {
  jest.restoreAllMocks();
  delete process.env.RAILI_MANUAL_CHOICE;
});

describe('manualHandler branch coverage additions', () => {
  test('normalizeApprovalResult throws on invalid legacy string', () => {
    expect(() => normalizeApprovalResult('MAYBE' as any)).toThrow(/invalid outcome/);
  });

  test('normalizeFeedbackResult throws on empty string', () => {
    expect(() => normalizeFeedbackResult('   ' as any)).toThrow(/empty feedback/);
  });

  test('loadApprovalResolver returns null for falsy path', () => {
    expect(loadApprovalResolver(null)).toBeNull();
  });

  test('handleManualTransition throws when no options provided', async () => {
    const cfg = { question: 'Proceed?', options: {} } as any;
    await expect(handleManualTransition(cfg)).rejects.toThrow(/No manual options provided/);
  });

  test('handleFeedbackPrompt throws when expose_var missing', async () => {
    const f = { expose_var: '' } as any;
    await expect(handleFeedbackPrompt(f)).rejects.toThrow(/expose_var must be provided/);
  });
});
