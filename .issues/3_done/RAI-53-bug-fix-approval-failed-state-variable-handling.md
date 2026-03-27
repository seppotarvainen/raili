# RAI-53: Fix approval failed state variable handling

**Type:** bug

## Description
Approval transitions set approval metadata (and FAILED reasons) after the approval prompt, but the Runner currently transitions immediately and never processes the state's `teach:` mappings in the same run. That causes variables exposed by approval (e.g. `CHECK_DONE_FAILED`) to be unavailable to `teach:` entries declared on the same state. This ticket fixes ordering so approval-exposed variables are visible to `teach:` in the originating state.

## Documentation References
- documentation/states.md
- documentation/output.md

## Code References
- src/runner/runner.ts (Runner.run, handleApproval, handleTeach)
- src/runner/approveStateRunner.ts (runApprovalStep)
- src/variables/variableInterpolation.ts (interpolation semantics used for approvals)
- __tests__/unit/runner/runner.teach.test.ts (unit tests for teach behavior)
- __tests__/integration/run-log-approval.integration.test.ts (integration patterns for approvals)

## Implementation Plan
Ordered file-level steps that the coding agent should perform:

1. **src/runner/runner.ts** — Modify the main run() loop around the approval handling (Phase 6) so that the state's `teach:` mapping is processed *after* approval and feedback but *before* routing to the next state. Concretely:
   - Replace the current block:
     ```ts
     if (config.approval) {
       stateId = await this.handleApproval(stateId, stateDef);
       continue;
     }
     ```
     with behavior that:
     - calls `this.handleApproval(stateId, stateDef)` and obtains `nextStateId`
     - ensures any approval-exposed variables (the handler already writes to `this.context.vars`) are available
     - if the state declares `teach`, call `await this.handleTeach(stateId, stateDef)` before continuing
     - set `stateId = nextStateId` and continue
   - Keep current approval metadata recording and variable writing logic intact in `handleApproval`.

2. **src/runner/runner.ts** — Ensure `handleTeach` is safe to call after `handleApproval` (it already reads `this.context.vars`) and does not rely on stateResult from `executeState` — no API change needed.

3. **__tests__/unit/runner/runner.teach.test.ts** — Add a unit test that simulates an approval occurring in the same state and verifies that `appendUniqueLearning` is invoked with the approval-failure variable. Sketch:
   - Mock `runApprovalStep` to return { chosen: 'FAILED', reason: 'Bad reason', target: 'rework' }
   - Make a state `check_done` of type `engine` with `approval` configured and `teach: { raili-coding: [{ var: '${CHECK_DONE_FAILED}' }] }`
   - Run runner and assert `appendUniqueLearning('/tmp', 'raili-coding', 'var:CHECK_DONE_FAILED', 'Bad reason', undefined)` was called.

4. **__tests__/integration/** — Add an integration test (optional but recommended) that uses `createTmpWorkspace()` and `writeWorkflow()` to assert end-to-end behavior: approval notify runs, user choice set via `process.env.RAILI_MANUAL_CHOICE='FAILED'`, and the learning file is created under `.raili/<workflow>/learnings/<agentId>.md` or `appendUniqueLearning` mock is called.

5. **Documentation (optional)** — Update documentation/states.md to note that `teach:` is processed after approval and feedback to allow approvals to expose variables used as teach inputs.

6. Run tests: `npm test -- -u` and ensure all unit and integration tests pass.

## Examples

### Example workflow YAML
```yaml
check_done:
  type: engine
  reset_outputs:
    - test
    - build
  approval:
    multiline: true
    notify: say "Completed $RAILI_VAR_ID. Waiting for approval" && echo "Waiting for approval"
    question: "Do you want to commit the changes?"
    PASSED: move_to_done
    FAILED: code
  teach:
    raili-coding:
      - var: ${CHECK_DONE_FAILED}
```

### Expected behavior / output
- When the approval prompt is answered with FAILED and a reason is supplied (e.g. "Insufficient tests"), the Runner writes `CHECK_DONE_FAILED` into `context.vars` and then processes the state's `teach:` mapping.
- The learning is appended: `.raili/main/learnings/raili-coding.md` (or appendUniqueLearning called) with source `var:CHECK_DONE_FAILED` and content equal to the provided reason.

Before (current): Runner performs approval and immediately routes to next state; `teach:` is not executed for the approving state, causing `State 'check_done' references undeclared variable '${CHECK_DONE_FAILED}'` errors.

After (fixed): Runner runs `handleTeach` after approval so `teach:` can consume approval-exposed vars in the same state.

### Before/After code snippet (runner.run loop)
Before:
```ts
if (config.approval) {
  stateId = await this.handleApproval(stateId, stateDef);
  continue;
}
```
After:
```ts
if (config.approval) {
  const next = await this.handleApproval(stateId, stateDef);
  if ((stateDef.config as any).teach) await this.handleTeach(stateId, stateDef);
  stateId = next;
  continue;
}
```

## Test Plan

### Unit tests (`__tests__/unit/`)
- **File:** `__tests__/unit/runner/runner.teach.test.ts` (edit)
- **Test case:** "teach runs after approval and uses approval-failure var"
  - Setup: jest.mock `runApprovalStep` to return { chosen: 'FAILED', reason: 'Bad reason', target: 'code' }
  - Setup: mock `appendUniqueLearning` to capture calls
  - Act: Create Runner with initial state `check_done` (type: engine) that defines `approval` and `teach` mapping referencing `${CHECK_DONE_FAILED}`. Call `await runner.run()`
  - Assert: `appendUniqueLearning` called with arguments (`cwd`, 'raili-coding', 'var:CHECK_DONE_FAILED', 'Bad reason', undefined)

- **File:** `__tests__/unit/runner/approveStateRunner.test.ts` (review)
  - Ensure existing tests still pass: `interpolateString` behavior, notify invocation, and return shape.

### Integration tests (`__tests__/integration/`)
Follow patterns in `__tests__/integration/testUtils.ts`:

- **File:** `__tests__/integration/approval.teach.integration.test.ts`
- **Test case:** "end-to-end: approval exposes var and teach appends learning"
  - Setup: create tmp workspace, write workflow YAML (as Example workflow YAML above), write minimal agent-registry with `raili-coding` agent file, mock child_process.spawn such that notify command runs but approval prompt is simulated by setting `process.env.RAILI_MANUAL_CHOICE='FAILED'` and `process.env.RAILI_FEEDBACK_*` if needed.
  - Act: run `runCommand(tmp, 'clean', {})` (or invocation used by test utilities)
  - Assert: learning file `.raili/main/learnings/raili-coding.md` exists and contains the approval reason or that the appendUniqueLearning mock was called with expected args.

Mock patterns to reuse:
- jest.mock('child_process', () => ({ spawn: jest.fn() }));
- const { spawn } = require('child_process');
- Use `fakeChild(stdout, stderr, exitCode)` from test utilities for simulating command outputs
- Use `cleanupRailiEnvVars()` in afterEach

## Acceptance Criteria
- [x] Runner executes `teach:` mappings declared on a state that has `approval:` after the approval decision is made (before routing away from the state).
- [x] Approval-exposed variables (e.g. `STATEID_FAILED`) are present in `this.context.vars` when `handleTeach` runs.
- [x] Unit test added verifying teach consumes approval-failure var in the same state; tests pass locally (`npm test`).
- [x] Integration test (recommended) verifies end-to-end behavior using existing test utilities.


---

**Ticket created:** RAI-53 (bug)
