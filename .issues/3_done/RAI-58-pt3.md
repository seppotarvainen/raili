# RAI-58 — Part 3: Integration tests and documentation

**Parent ticket:** RAI-58 (RAI-58-feature-continue-transition.md)

## Scope
Add integration tests exercising `continue` for agent and script states, and update documentation to describe the new unconditional routing option and how it differs from terminal states.

## Files to Modify / Create
- __tests__/integration/routing.test.ts — add integration tests for agent and script continue behavior and invalid target
- documentation/routing.md — add "Unconditional Routing (continue:)" section with examples
- documentation/states.md — add notes clarifying terminal vs continue routing

## Implementation Steps
1. Create __tests__/integration/routing.test.ts using existing test helpers (create tmp workspace, writeWorkflow, writeAgentRegistry, writeAgentFile, fakeChild) to assert analyze->next_state via `continue` for agent and script states (both success/failure).
2. Add test asserting invalid continue target is detected during load/build.
3. Update documentation/routing.md with a short section and YAML examples demonstrating `continue` usage and mutual-exclusivity note.
4. Update documentation/states.md to mention `continue` vs terminal states.
5. Run integration tests (mocked spawn) and verify docs build if applicable.

## Acceptance Criteria

- [x] Integration tests covering agent/script continue paths added and passing in CI
- [x] Invalid continue target tested and fails during workflow load
- [x] documentation/routing.md updated with examples and notes
- [x] documentation/states.md updated to reference `continue`


## Context from Parent
- Integration test examples and expectations (agent script mapping and assertions) are provided in the parent ticket and should be used as the test body templates.

- Documentation excerpt from parent: "Routes to a target state unconditionally, regardless of outcome or exit code... `continue` is mutually exclusive with `on:`, `transitions:`, and `approval:`."