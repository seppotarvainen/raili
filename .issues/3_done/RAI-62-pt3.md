# RAI-62 — Part 3: Runner wiring, state runners, and integration tests

**Parent ticket:** RAI-62 (RAI-62-feature-pluggable-approval-feedback-resolvers.md)

## Scope
Wire resolver discovery and execution into the runner and state runners. Ensure approval and feedback resolver paths are resolved before execution and passed into approval/feedback handling. Add unit and integration tests to validate end-to-end behavior and fail-fast semantics.

## Files to Modify
- src/runner/approveStateRunner.ts — accept resolver path and pass resolver to manual handler
- src/runner/runner.ts — resolve resolver paths before run loop and pass to approval/feedback execution points
- src/runner/stateRunnerUtils.ts — ensure `outputPath` is resolved and available to pass to resolver input
- __tests__/unit/approveStateRunner.test.ts — verify resolver is forwarded
- __tests__/integration/approval-resolver.integration.test.ts — integration test: approval resolver causes PASSED/FAILED routing
- __tests__/integration/feedback-resolver.integration.test.ts — integration test: feedback resolver returns feedback and it is exposed as var
- documentation/approval.md — add examples of creating resolver files and behavior

## Implementation Steps
1. Update `src/runner/runner.ts`:
   - Add resolver path resolution at startup using `resolveApprovalResolverPath()` and `resolveFeedbackResolverPath()` from pathUtils (part 1).
   - Store resolved paths in the runner context and pass them into approval/feedback handling points.
2. Update `src/runner/approveStateRunner.ts`:
   - Update `runApprovalStep()` to accept `approvalResolverPath?: string | null`.
   - Use handler loader (`loadApprovalResolver`) from manualHandler to load the resolver and pass the function into `handleManualTransition()`.
3. Update `src/runner/stateRunnerUtils.ts`:
   - Ensure `outputPath` (if outputs are stored) is deterministically resolved and available so resolvers may inspect it. If already present, add a small unit test documenting expected value.
4. Tests:
   - Unit: `approveStateRunner.test.ts` ensures resolver path is forwarded and handler receives resolver.
   - Integration: two integration tests (approval and feedback) following repo patterns. Use temp workspace helpers to create workflows and resolver files that return PASSED/FAILED or feedback string, run `runCommand(tmp, 'clean', {})`, and assert on context or final state.
5. Documentation:
   - Add runnable examples and note fail-fast semantics when resolver throws.

## Acceptance Criteria
- [x] Runner resolves resolver paths at startup using path utils
- [x] `approveStateRunner.runApprovalStep()` accepts resolver path and forwards loaded resolver to manual handler
- [x] `outputPath` is available in resolver input when relevant
- [x] Integration tests cover PASSED, FAILED, and throwing resolver cases
- [x] Documentation is updated with examples and discovery semantics

## Context from Parent
From the parent ticket:
- Runner wiring: resolve both approval and feedback resolver paths before entering execution loop and pass resolved paths to `runApprovalStep()` and feedback handlers (Implementation Plan lines 51–55)
- Tests: Integration tests for approval and feedback resolver behaviors and fail-fast semantics (Test Plan lines 220–296)