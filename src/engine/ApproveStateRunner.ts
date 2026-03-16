import { ApprovalConfig } from '../types';
import { handleManualTransition } from '../handlers/manualHandler';
import { runNotify } from '../handlers/notifyHandler';
import { interpolateString } from '../variableInterpolation';
import { WorkflowContext } from '../types';

export interface ApprovalStepOptions {
  cwd: string;
  context?: WorkflowContext;
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
): Promise<string> {

  if (approval.notify) {
    await runNotify(approval.notify, options.cwd, options.context?.vars ?? {});
  }

  // Interpolate the question with variables from context
  const vars = options.context?.vars ?? {};
  const interpolatedQuestion = interpolateString(approval.question, vars);

  const result = await handleManualTransition({
    question: interpolatedQuestion,
    options: {
      PASSED: approval.PASSED,
      FAILED: approval.FAILED,
    },
  });

  return result.chosen;
}
