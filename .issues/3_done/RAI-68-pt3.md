# RAI-68 — Part 3: Timeouts for approval and feedback handlers

**Parent ticket:** RAI-68 (RAI-68-feature-trigger_approval_feedback_resolver_configurable.md)

## Scope
Add timeout support to manual approval and feedback handlers so prompts honor configured timeouts. Update runner callsites to pass configured timeout values where appropriate.

## Files to Modify
- src/handlers/manualHandler.ts — update `handleManualTransition()` and `handleFeedbackPrompt()` to accept `timeoutMs?: number` and enforce timeout via `Promise.race()`
- src/runner/approveStateRunner.ts — pass approval timeout from resolver config into manual handler
- src/runner/runner.ts — ensure any feedback handlers get timeout passed through
- __tests__/unit/manualHandler.test.ts — NEW unit tests for timeout behavior

## Implementation Steps
1. Modify `handleManualTransition()` signature to include optional `timeoutMs?: number` and implement timeout via `Promise.race([promptPromise, timeoutPromise])`.
2. Modify `handleFeedbackPrompt()` similarly to support timeout.
3. Update `approveStateRunner.ts` to read approval timeout from resolver config (from context or loader result) and pass `timeoutMs` into handler calls.
4. Update `runner.ts` where feedback prompts are invoked to pass `feedback.timeout` when available.
5. Add unit tests verifying that when `timeoutMs` is small the handler rejects with a timeout error and when `timeoutMs` is unset the handler behaves as before.

## Acceptance Criteria
- [ ] `handleManualTransition()` and `handleFeedbackPrompt()` accept `timeoutMs?: number` and enforce timeouts
- [ ] `approveStateRunner.ts` passes configured approval timeout into handlers
- [ ] Unit tests cover timeout and non-timeout behavior
- [ ] `__tests__/unit/runner/approvalInterpolation.test.ts` updated to match new 4-argument call signature of `handleManualTransition`
- [ ] `src/cli/teach.ts` calls `process.stdin.unref()` in the readline close handler to solve open handle error and let Jest exit gracefully
- [ ] Optional: add test coverage since especially branch coverage is nearly at its threshold (80%)

## Context from Parent

Parent guidance:

- "Add `timeoutMs?: number` parameter to both functions"
- "Wrap readline/prompt logic in `Promise.race([...], Promise with timeout])` to enforce timeout"
- "On timeout, throw error with message: \"Approval prompt timeout exceeded\""
