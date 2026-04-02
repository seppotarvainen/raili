# RAI-60 — Part 2: Runner Logic and Unit Tests for Reset Behavior

**Parent ticket:** RAI-60 (RAI-60-feature-add-reset-max-visits.md)

## Scope
Implement the runtime visit-counter reset logic in the runner and add unit tests that assert `reset_max_visits` correctly clears visit counts so nested loops can re-use inner loop budgets per outer iteration.

## Files to Modify
- src/runner/runner.ts — modify `enterState()` to perform visit count resets for configured targets
- __tests__/unit/runner/runner.maxvisits.test.ts — add a test case verifying `reset_max_visits` resets visit counts and allows repeated inner loops

## Implementation Steps
1. Inspect current `enterState()` implementation and locate visitCounts management and max_visits check.
2. After the max_visits enforcement (or at the appropriate entry phase as described in the parent ticket), add logic:
   - If `config.reset_max_visits` is present, iterate `for (const stateId of config.reset_max_visits) { this.visitCounts.delete(stateId); }`
3. Ensure this logic is deterministic and only affects in-memory visitCounts (not persisted in context.json) so resume behavior is unchanged.
4. Add a unit test "reset_max_visits resets visit counter for specified states" to `runner.maxvisits.test.ts` that:
   - Builds a small state machine with `outer` (resetting `inner`) and `inner` with `max_visits.count: 2`.
   - Mocks handlers to simulate transitions so `inner` is entered twice per outer iteration and `outer` runs multiple times.
   - Asserts no max_visits error occurs and final state is `end`.
5. Run unit tests; iterate until this part's tests pass.

## Acceptance Criteria
- [ ] `enterState()` clears visitCounts for state IDs listed in `reset_max_visits` using `this.visitCounts.delete()`
- [ ] Unit test confirms inner-loop visit counts are reset across outer iterations and no max_visits error is thrown
- [ ] Changes do not persist visit counts (resume unchanged)

## Context from Parent
- Implementation plan: modify `enterState()` to reset visit counts for states listed in `config.reset_max_visits`.
- Test plan: unit test described in parent ticket under "reset_max_visits resets visit counter for specified states".
