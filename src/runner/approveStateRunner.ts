import { ApprovalConfig, WorkflowContext } from '../types';
import {
  handleManualTransition,
  ManualResult,
  ManualTransitionConfig,
  loadApprovalResolver,
} from '../handlers/manualHandler';
import { NotifyResult, runNotify } from '../handlers/notifyHandler';
import { outputPath } from '../context/outputStore';
import { interpolateString } from '../variables/variableInterpolation';

interface ApprovalStepOptions {
  cwd: string;
  context?: WorkflowContext;
  workflowArg?: string;
}

export interface ApprovalOutcome {
  chosen: string;
  target: string;
  reason: string;
  question: string;
  notify?: NotifyResult;
  waitMs?: number;
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
  approvalResolverPath?: string | null,
): Promise<ApprovalOutcome> {
  let notifyRes: NotifyResult | undefined = undefined;
  if (approval.notify) {
    notifyRes = await runNotify(approval.notify, options.cwd, options.context?.vars ?? {});
  }

  // Interpolate the question with variables from context (YAML semantics: missing -> empty string)
  const vars = options.context?.vars ?? {};
  const interpolatedQuestion = interpolateString(approval.question, vars, {
    throwOnMissing: false,
    missingValue: '',
  });

  const manualCallArg: ManualTransitionConfig = {
    question: interpolatedQuestion,
    options: {
      PASSED: approval.PASSED,
      FAILED: approval.FAILED,
    },
    multiline: approval.multiline,
  };

  // If an approval resolver path was provided, attempt to load the resolver (fail-fast when a path string is supplied)
  let approvalResolver = null;
  let outPath: string | null = null;
  if (typeof approvalResolverPath !== 'undefined' && approvalResolverPath !== null) {
    approvalResolver = loadApprovalResolver(approvalResolverPath);
  }

  // Provide outputPath and vars to the resolver via manual handler's input shape if a resolver is actually present.
  if (approvalResolver) {
    // compute deterministic output path for the state (may point to a non-existent file)
    // Guard against workspaces that don't have .raili initialized (unit tests); if resolving the path fails, continue with null.
    try {
      outPath = outputPath(options.cwd, stateId, options.workflowArg);
    } catch (e) {
      outPath = null;
    }

    const result: ManualResult = await handleManualTransition(manualCallArg, approvalResolver, {
      vars,
      outputPath: outPath,
      stateName: stateId,
    });
    return {
      chosen: result.chosen,
      target: result.target,
      reason: result.reason,
      question: interpolatedQuestion,
      notify: notifyRes,
      waitMs: result.waitMs,
    };
  }

  // No resolver provided — call manual handler in its simplest form so unit tests can assert on a single argument
  const result: ManualResult = await handleManualTransition(manualCallArg);

  return {
    chosen: result.chosen,
    target: result.target,
    reason: result.reason,
    question: interpolatedQuestion,
    notify: notifyRes,
    waitMs: result.waitMs,
  };
}
