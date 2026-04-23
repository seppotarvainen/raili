# RAI-78 — Part 3: Apply rollback in run loop & integration tests

**Parent ticket:** RAI-78 (RAI-78-feature-rollback-capability.md)

## Scope
Wire the parsed `rollback` value into `runCommand()` and apply `rollbackHistory()` after loading context and before the runner loop begins. Persist the rolled-back context immediately. Add integration tests that exercise end-to-end behavior: build history, apply rollback (by count and by state), and verify persisted context and resumed state.

## Files to Modify
- src/run.ts — accept `rollback?: string` param in `runCommand()` and apply rollback after loading context
- src/runner/runner.ts — (review) ensure runner initialization continues from last entry in context (likely no code change, but verify)
- __tests__/integration/rollback.integration.test.ts — new integration tests exercising the full flow

## Implementation Steps
1. Update `runCommand()` signature in `src/run.ts` to accept an optional `rollback?: string` parameter (preserve backward compat by defaulting to undefined).
2. After loading context (before entering run loop), if `rollback` is provided call `rollbackHistory(context, rollback)` and assign the returned context.
3. Save the modified context to disk immediately (use existing `saveContext()` helper) so `.raili/<workflow>/context.json` is updated before execution continues.
4. Ensure runner picks up the new current state (last entry in `stateHistory`) and continues normally.
5. Add integration test file `__tests__/integration/rollback.integration.test.ts` following repository integration patterns: create temp workspace, build workflow, mock child_process, build history, run `runCommand()` with rollback values and assert on persisted context and resumed state. Include tests from parent ticket (rollback N, rollback to state, errors, preserve vars).
6. Run tests and adjust mocks if necessary.

## Acceptance Criteria
- [x] `runCommand()` accepts `rollback` and applies `rollbackHistory()` prior to starting the runner
- [x] Modified context saved to `.raili/<workflow>/context.json` before runner continues
- [x] Runner resumes from the new last history entry
- [x] Integration tests exercise count and state rollbacks, including error cases and preservation of `vars`/`approvals`/`feedbacks`
- [x] All new tests pass in CI patterns used by repo

## Context from Parent
Relevant sections for behavior and tests:
- "In `runCommand()` ... Before entering the run loop, check if `rollback` is provided in 'continue' mode ... call `rollbackHistory()` and overwrite context ... Save the rolled-back context to disk immediately"
- Integration test guidance and example test cases (lines describing test utilities, mocking child_process, and example assertions)