import { ApprovalConfig } from '../types';
import { handleManualTransition } from '../handlers/manualHandler';
import type { StateOutcome } from './Engine';


/**
 * Runs the approval prompt for a state that has an `approval` block.
 * Delegates to manualHandler and returns the chosen outcome key (PASSED / FAILED).
 */
export function runApprovalStep(stateId: string, approval: ApprovalConfig): StateOutcome {
  const result = handleManualTransition({
    question: approval.question,
    options: {
      PASSED: approval.PASSED,
      FAILED: approval.FAILED,
    },
  });

  return result.chosen;
}

