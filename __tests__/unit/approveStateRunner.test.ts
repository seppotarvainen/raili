import {runApprovalStep} from '../../src/runner/ApproveStateRunner';
import * as notifyHandler from '../../src/handlers/notifyHandler';
import * as manualHandler from '../../src/handlers/manualHandler';

jest.mock('../../src/handlers/notifyHandler');
jest.mock('../../src/handlers/manualHandler');

const mockRunNotify = notifyHandler.runNotify as jest.MockedFunction<typeof notifyHandler.runNotify>;
const mockHandleManual = manualHandler.handleManualTransition as jest.MockedFunction<typeof manualHandler.handleManualTransition>;

const approval = {
  question: 'Is the analysis correct?',
  PASSED: 'hello',
  FAILED: 'analyze',
};

beforeEach(() => {
  jest.resetAllMocks();
  mockHandleManual.mockResolvedValue({ chosen: 'PASSED', target: 'hello', reason: '' });
});

test('runs approval prompt with no approval-level notify', async () => {
  const outcome = await runApprovalStep('analyze', approval, { cwd: '/tmp' });

  expect(mockRunNotify).not.toHaveBeenCalled();
  expect(mockHandleManual).toHaveBeenCalledTimes(1);
  expect(outcome.chosen).toBe('PASSED');
  expect(outcome.question).toContain('Is the analysis correct');
});

test('runs approval-level notify before the prompt', async () => {
  mockRunNotify.mockResolvedValue({ command: 'slack-notify "done"', success: true });

  const approvalWithNotify = { ...approval, notify: 'slack-notify "done"' };
  await runApprovalStep('analyze', approvalWithNotify, { cwd: '/tmp' });

  expect(mockRunNotify).toHaveBeenCalledWith('slack-notify "done"', '/tmp', {});
  expect(mockRunNotify).toHaveBeenCalledTimes(1);
  expect(mockHandleManual).toHaveBeenCalledTimes(1);
});

test('returns FAILED outcome from manual handler', async () => {
  mockHandleManual.mockResolvedValue({ chosen: 'FAILED', target: 'analyze', reason: 'wrong' });

  const outcome = await runApprovalStep('analyze', approval, { cwd: '/tmp' });

  expect(outcome.chosen).toBe('FAILED');
  expect(outcome.reason).toBe('wrong');
});

test('notify failure does not prevent approval prompt (best-effort)', async () => {
  mockRunNotify.mockResolvedValue({ command: 'bad-command', success: false, stderr: 'nope' });

  const approvalWithNotify = { ...approval, notify: 'bad-command' };
  const outcome = await runApprovalStep('analyze', approvalWithNotify, { cwd: '/tmp' });

  expect(mockHandleManual).toHaveBeenCalledTimes(1);
  expect(outcome.chosen).toBe('PASSED');
});
