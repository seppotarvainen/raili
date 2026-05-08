# RAI-82: Remove `<state>.latest.md` when the parent is removed

**Type:** fix

## Description

When a state's outputs are reset via `reset_outputs` configuration, the `<state>.md` history file is deleted but the accompanying `<state>.latest.md` file is not. This can cause confusion if a workflow later uses the `.latest.md` output (e.g., to check test results) that should have been cleared. The `.latest.md` file must also be removed to keep the output state consistent.

## Documentation References
- documentation/output.md (lines 133-145: "Resetting Memory" section)

## Code References
- src/context/outputStore.ts (clearAgentOutputs function, lines 280-288)
- src/context/outputStore.ts (clearAllOutputs function, lines 294-301)
- src/runner/stateEntryManager.ts (reset_outputs handling, line 99)
- src/runner/routingManager.ts (error reset_outputs handling, line 104)

## Implementation Plan

1. **src/context/outputStore.ts** — Modify `clearAgentOutputs()` function to also delete `.latest.md` files alongside `.md` files
   - For each state ID, compute both the standard output path (`<state>.md`) and the latest output path (`<state>.latest.md`)
   - Delete both files if they exist (silent if not)

2. **__tests__/unit/context/outputStore.test.ts** — Add unit tests for the updated `clearAgentOutputs()` function
   - Test that both `.md` and `.latest.md` files are deleted
   - Test graceful handling when files don't exist

3. **__tests__/integration/outputStore.test.ts** — Add integration test for reset_outputs with latest file cleanup
   - Create a workflow with `reset_outputs` that references a state with stored output
   - Verify both history and latest files are cleaned up

## Examples

### Workflow with reset_outputs

```yaml
initial: analyze
states:
  analyze:
    type: agent
    agent: analyzer
    output:
      store: true
      marker: "RESULT:"
    on:
      PASSED: test
  
  test:
    type: script
    script: run-tests
    output:
      store: true
    on:
      PASSED: done
      FAILED: retry
  
  retry:
    type: engine
    reset_outputs:
      - analyze
      - test
    on:
      PASSED: analyze
```

### Expected behavior

When the `retry` state is entered:
- `.raili/main/outputs/analyze.md` is deleted ✓
- `.raili/main/outputs/analyze.latest.md` is also deleted (currently NOT deleted, needs fix)
- `.raili/main/outputs/test.md` is deleted ✓
- `.raili/main/outputs/test.latest.md` is also deleted (currently NOT deleted, needs fix)

On the next run through `analyze`, the agent will have no prior output to reference (fresh context), preventing confusion from stale test results.

## Test Plan

### Unit tests (`__tests__/unit/context/outputStore.test.ts`)

- **Test case:** "clearAgentOutputs deletes both .md and .latest.md files"
  - Setup: Create fake filesystem with files:
    - `.raili/main/outputs/analyze.md` (content: "analysis output")
    - `.raili/main/outputs/analyze.latest.md` (content: "latest analysis")
    - `.raili/main/outputs/test.md` (content: "test output")
  - Act: Call `clearAgentOutputs(cwd, ['analyze', 'test'], 'main')`
  - Assert: 
    - `analyze.md` does not exist
    - `analyze.latest.md` does not exist
    - `test.md` does not exist
    - No errors thrown

- **Test case:** "clearAgentOutputs handles missing files gracefully"
  - Setup: Fake filesystem with no output files
  - Act: Call `clearAgentOutputs(cwd, ['missing1', 'missing2'], 'main')`
  - Assert: No errors thrown, function completes silently

- **Test case:** "clearAgentOutputs handles group sub-states (final segment only)"
  - Setup: Create fake filesystem with:
    - `.raili/main/outputs/sub.md`
    - `.raili/main/outputs/sub.latest.md`
  - Act: Call `clearAgentOutputs(cwd, ['group.sub'], 'main')` (virtual state ID)
  - Assert:
    - `sub.md` does not exist
    - `sub.latest.md` does not exist

### Integration tests (`__tests__/integration/outputStore.test.ts`)

- **Test case:** "reset_outputs clears both history and latest files during state entry"
  - Setup:
    ```yaml
    initial: analyze
    states:
      analyze:
        type: agent
        agent: test-agent
        output:
          store: true
        on:
          PASSED: reset_step
      reset_step:
        type: engine
        reset_outputs:
          - analyze
        on:
          PASSED: done
      done:
        type: engine
    ```
  - Mock: `spawn` returns `fakeChild('test output', '', 0)` for analyze state
  - Act:
    1. Run `raili run` → executes `analyze` state, saves output to both `.md` and `.latest.md`
    2. Verify files exist: `.raili/main/outputs/analyze.md` and `.raili/main/outputs/analyze.latest.md`
    3. Continue run → enters `reset_step` state, which calls `reset_outputs: [analyze]`
    4. Verify files are deleted: both `.md` and `.latest.md` should not exist
  - Assert:
    - After reset, both output files are gone
    - No errors during execution

## Acceptance Criteria

- [ ] `clearAgentOutputs()` in `src/context/outputStore.ts` deletes both `<state>.md` and `<state>.latest.md` files
- [ ] Function handles group sub-states correctly (uses final segment only, same as `.md` file)
- [ ] Function gracefully handles missing files (silent, no errors)
- [ ] Unit tests added covering all cases (both files deleted, missing files, group states)
- [ ] Integration test added verifying reset_outputs clears both file types during state entry
- [ ] All existing tests pass (no regressions)
