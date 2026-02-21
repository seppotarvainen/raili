import { handleManualTransition } from '../src/handlers/manualHandler';

test('defaults to first option when no env set', () => {
  delete process.env.RAILI_MANUAL_CHOICE;
  const cfg = { question: 'Okay?', options: { PASSED: 'execute', FAILED: 'analyze' } };
  const res = handleManualTransition(cfg as any);
  expect(res.chosen).toBe('PASSED');
  expect(res.target).toBe('execute');
});

test('uses env override when set', () => {
  process.env.RAILI_MANUAL_CHOICE = 'FAILED';
  const cfg = { question: 'Okay?', options: { PASSED: 'execute', FAILED: 'analyze' } };
  const res = handleManualTransition(cfg as any);
  expect(res.chosen).toBe('FAILED');
  expect(res.target).toBe('analyze');
  delete process.env.RAILI_MANUAL_CHOICE;
});
