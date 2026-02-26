import { ApprovalConfig } from '../types';
import { handleManualTransition } from '../handlers/manualHandler';
import { runNotify } from '../handlers/notifyHandler';
import type { StateOutcome } from './Engine';

export interface ApprovalStepOptions {
  cwd: string;
}

/**
 * Runs the approval prompt for a state that has an `approval` block.
 * Fires approval-level notify (if any) then delegates to manualHandler.
 * State-level notify is fired by the Engine on state entry, before this is called.
 */
export async function runApprovalStep(
  stateId: string,
  approval: ApprovalConfig,
  options: ApprovalStepOptions,
): Promise<StateOutcome> {

  if (approval.notify) {
    await runNotify(approval.notify, options.cwd);
  }

  const result = await handleManualTransition({
    question: approval.question,
    options: {
      PASSED: approval.PASSED,
      FAILED: approval.FAILED,
    },
  });

  return result.chosen;
}
