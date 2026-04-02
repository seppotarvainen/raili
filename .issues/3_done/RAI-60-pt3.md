# RAI-60 — Part 3: Integration Test and Documentation

**Parent ticket:** RAI-60 (RAI-60-feature-add-reset-max-visits.md)

## Scope
Add an integration test that exercises nested outer/inner loops to demonstrate `reset_max_visits` works across multiple outer iterations. Update `documentation/states.md` with an example and explanation.

## Files to Modify
- __tests__/integration/reset_max_visits.test.ts — create integration test that runs a temp workspace with outer/inner loop example
- documentation/states.md — add section describing `reset_max_visits`, include YAML example from parent ticket

## Implementation Steps
1. Create `__tests__/integration/reset_max_visits.test.ts` following existing integration test patterns (createTmpWorkspace, writeWorkflow, writeAgentRegistry, spawn mock). Use the example YAML from the parent ticket.
2. Mock `child_process.spawn` to simulate command exits for `outer` and `inner` states so the test deterministically traverses outer → inner (twice) → outer → inner (twice) → end.
3. Assert the final state is `end`, and that stateHistory demonstrates multiple outer iterations and inner resets.
4. Update `documentation/states.md` (or appropriate docs file) with a short section explaining `reset_max_visits` and include the example workflow YAML from the parent ticket.
5. Run integration tests locally (note: CI may run full suite); ensure the new test adheres to existing test helpers and cleans up env vars.

## Acceptance Criteria
- [ ] Integration test `reset_max_visits.test.ts` added and reproduces nested-loop behavior in a sandboxed workspace
- [ ] Documentation updated with example and explanation
- [ ] Overall feature validated end-to-end by test

## Context from Parent
- Example YAML and expected behavior (parent ticket lines 41-69).
- Integration test sketch provided in parent ticket; follow same helper patterns (createTmpWorkspace, fakeChild, runCommand).
