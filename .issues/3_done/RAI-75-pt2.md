# RAI-75 — Part 2: Integration tests and end-to-end verification (script only)

**Parent ticket:** RAI-75 (RAI-75-bug-script_command_variable_interpolation.md)

## Scope
Add integration tests to verify that interpolation occurs during full workflow execution for script states. These tests exercise the runner changes in realistic sandboxed workflows using existing test helpers and mocked spawn.

## Files to Modify / Add
- __tests__/integration/script.test.ts — add test: "interpolates variables in script args during workflow execution"
- (No production code changes expected in this part; relies on Part 1 changes)

## Implementation Steps
1. Create integration test `__tests__/integration/script.test.ts` using the testUtils pattern:
   - Create tmp workspace, write a workflow with a script state whose `args` include `${filename}`.
   - Register a script file under scripts/ and a script registry entry.
   - Mock `spawn` to assert the script receives interpolated args (e.g., ['myfile.txt', 'backup.tar.gz']).
   - Run the workflow (runCommand) and assert terminal state is `done`.
2. Run the integration test locally (npm test -- __tests__/integration/script.test.ts) to verify.

## Acceptance Criteria
- [x] Integration test for script state demonstrates args were interpolated before invocation
- [ ] End-to-end tests pass locally without altering existing test harness behavior

## Context from Parent
(Selected relevant excerpts)

- Integration test example from parent ticket demonstrating expected test harness usage and assertions (verifies spawn args):
  - `__tests__/integration/script.test.ts` example that asserts args equal `['myfile.txt', 'backup.tar.gz']` and final state `done`.

Note: Part 2 depends on Part 1 being implemented and unit-tested; keep parts ordered accordingly.