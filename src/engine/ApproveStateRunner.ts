import { ApprovalConfig } from '../types';
import { handleManualTransition } from '../handlers/manualHandler';
import type { StateOutcome } from './Engine';

/**
 * Runs the approval prompt for a state that has an `approval` block.
 * Delegates to manualHandler and returns the chosen outcome key (PASSED / FAILED).
 */
export async function runApprovalStep(stateId: string, approval: ApprovalConfig): Promise<StateOutcome> {
  const result = await handleManualTransition({
    question: approval.question,
    options: {
      PASSED: approval.PASSED,
      FAILED: approval.FAILED,
    },
  });

  return result.chosen;
}

