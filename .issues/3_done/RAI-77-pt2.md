# RAI-77 — Part 2: Runner step-limiting implementation and unit tests

**Parent ticket:** RAI-77 (RAI-77-feature-next_steps_flag.md)

## Scope
Implement the `nextSteps` enforcement inside the Runner loop so the engine executes at most N states per run (counting entered, non-skipped states). Add unit tests for the runner behavior (stopping after N steps, handling terminal states before limit).

## Files to Modify
- src/runner/runner.ts — add `nextSteps` field to Runner, track executed-state counter, break when limit reached; ensure context persisted correctly
- __tests__/unit/runner.test.ts — add unit tests for step limiting and mid-execution stop

## Implementation Steps
1. Ensure `RunnerConfig` (from src/types.ts) includes `nextSteps?: number` (pt1).
2. In `src/runner/runner.ts` constructor, accept and store `nextSteps` as a private field.
3. In the `run()` main loop, add a counter that increments when a state is actually executed (entered and not skipped). After execution (or after persist of context for that state), if `nextSteps` is defined and counter >= nextSteps, exit the loop gracefully and persist context.
4. When the limit is reached mid-workflow (even if state has transitions), treat the current run as ended — do not automatically follow transitions. Ensure `stateHistory` contains only executed states.
5. Write unit tests in `__tests__/unit/runner.test.ts`:
   - Runner with `nextSteps: 2` on 3-state linear workflow → only two states in history
   - Runner with `nextSteps: 1` and branching → only one entry
   - Runner stops when terminal state reached before limit

## Acceptance Criteria
- [ ] Runner supports `nextSteps` config and enforces limit
- [ ] Counter increments only for executed (entered, not skipped) states
- [ ] Context saved with exactly the executed states
- [ ] Unit tests cover limit behavior and pass

## Context from Parent
Relevant excerpts:
- "Runner class — Store `nextSteps` from config as a private field. In the `run()` method main loop add a step counter that tracks how many states have been executed... When `nextSteps` is defined and the counter reaches that limit, break from the loop and treat the current state as terminal" (parent Implementation Plan item 5).
- Test Plan unit tests for Runner behavior (parent lines ~144-153).