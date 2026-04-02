# RAI-59 — Part 4: AgentStateRunner wiring and integration tests

**Parent ticket:** RAI-59 (RAI-59-improvement-multiple-stored-outputs.md)

## Scope
Wire `use_latest` config through `AgentStateRunner` so it extracts the value from state config and passes it to `executeAgent()`. Add unit test(s) for the runner and integration tests that exercise end-to-end behavior across multiple runs. Depends on pt1–pt3.

## Files to Modify
- src/runner/agentStateRunner.ts — extract `use_latest` from `state.config.output?.use_latest` and pass to `executeAgent()`
- __tests__/unit/runner/agentStateRunner.multipleOutputs.test.ts — new unit tests
- __tests__/integration/multipleOutputs.test.ts — new or updated integration tests (use spawn mocks as per project patterns)

## Implementation Steps
1. Update `AgentStateRunner.run()` to read `const useLatest = state.config.output?.use_latest` and pass it into the `executeAgent()` call (preserving argument order used in pt3).
2. Add unit tests to assert the runner passes `useLatest` correctly when present and undefined when omitted.
3. Add integration tests that simulate multiple agent runs (using spawn.mockImplementation and fakeChild) verifying default behavior (all runs injected) and `use_latest: N` behavior (only last N runs injected). Follow existing integration testing helpers and env var patterns.
4. Ensure tests clean up RAILI env vars and that context persists as expected.

## Acceptance Criteria
- [x] AgentStateRunner passes `use_latest` through to handler
- [x] Unit tests for runner added and pass
- [x] Integration tests cover default (all) and `use_latest` behaviors and pass

## Context from Parent
From parent ticket:
"Modify `AgentStateRunner.run()` to extract `use_latest` from state config and pass it to `executeAgent()`; integration tests demonstrating runs across multiple executions are included in the parent ticket."