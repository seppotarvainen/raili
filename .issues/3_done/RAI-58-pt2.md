# RAI-58 — Part 2: Workflow loader and runner routing

**Parent ticket:** RAI-58 (RAI-58-feature-continue-transition.md)

## Scope
Wire `continue` into the state machine build and execution: ensure `buildStateMachine()` includes the continue target in state transitions and update the runner to route unconditionally to the `continue` target (present outcome label as CONTINUE).

## Files to Modify
- src/workflow/workflowLoader.ts — include `continue` target in StateDef.transitions and validate target exists
- src/runner/runner.ts — check for `continue` when routing and route unconditionally; label outcome as CONTINUE in logs
- __tests__/unit/runner.test.ts — add runner unit tests to assert unconditional routing and illegal combos at load time

## Implementation Steps
1. In buildStateMachine() (src/workflow/workflowLoader.ts), when a state defines `continue`, add that state id to the state's transitions array and validate the referenced target exists.
2. Update routeToNext()/routing logic in src/runner/runner.ts to check for `continue` before evaluating `on`/`transitions` and route directly to the target regardless of outcome.
3. When routing via `continue`, use a consistent outcome label (e.g., "CONTINUE") for logging and history entries.
4. Add unit tests in __tests__/unit/runner.test.ts to verify: unconditional routing happens for success and failure, and that invalid continue target triggers an error during build/load.
5. Run unit tests and address failures.

## Acceptance Criteria
- [ ] buildStateMachine includes continue targets and validates existence
- [ ] Runner routes unconditionally to `continue` targets and logs outcome as CONTINUE
- [ ] Unit tests for runner behavior exist and pass

## Context from Parent
- "When processing routing for a state with `continue`, add the continue target to the StateDef.transitions list."
- "In `routeToNext()`, check if state has `continue` field before falling back to `on`/`transitions`. If `continue` is set, route directly to that state without evaluating outcome."