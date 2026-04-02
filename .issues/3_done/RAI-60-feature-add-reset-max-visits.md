# RAI-60: Add reset_max_visits

**Type:** feature

## Description

Currently, the `max_visits` counter persists for the entire workflow execution and cannot be reset. This is problematic when users design nested loops (inner loops within outer loops) because the inner loop's `max_visits` limit becomes shared across multiple outer iterations. This feature adds a `reset_max_visits` field that allows a state to explicitly reset the visit counter for specified downstream states when entered, enabling complex multi-level looping patterns without artificial constraints.

## Documentation References

- documentation/states.md (section "Preventing Infinite Loops")

## Code References

- src/types.ts (StateConfig interface)
- src/workflow/schemas.ts (StateConfigSchema definition)
- src/runner/runner.ts (Runner class, visitCounts management, enterState method)
- src/workflow/stateValidator.ts (state validation logic)

## Implementation Plan

1. **src/types.ts** — Add `reset_max_visits?: string[]` field to `StateConfig` interface (array of state IDs to reset on entry)

2. **src/workflow/schemas.ts** — Add schema definition for `reset_max_visits` to `StateConfigSchema`:
   - Type: `array`
   - Required: `false`
   - Description: "List of state IDs whose max_visits counter should be reset when this state is entered"

3. **src/runner/runner.ts** — Modify `enterState()` method:
   - After the existing `max_visits` check logic, add code to reset visit counts for states listed in `config.reset_max_visits`
   - Iterate over each state ID in `reset_max_visits` and call `this.visitCounts.delete(stateId)` to clear their visit counters

4. **src/workflow/stateValidator.ts** — Add validation:
   - Check that all state IDs listed in `reset_max_visits` exist in the state machine (fail-fast)
   - Add to validation logic that runs at startup before execution begins

## Examples

### Example workflow YAML

```yaml
initial: loop_outer
states:
  loop_outer:
    type: command
    command: echo "Outer loop iteration"
    reset_max_visits:
      - loop_inner
    on:
      PASSED: loop_inner
      FAILED: error_state

  loop_inner:
    type: command
    command: echo "Inner loop iteration"
    max_visits:
      count: 3
    on:
      PASSED: loop_inner  # loops back, resets after 3 attempts
      FAILED: loop_outer

  error_state:
    type: engine
```

### Expected behavior / output

**Scenario:** With the workflow above, the outer loop can run multiple times, and each time it enters `loop_outer`, the `loop_inner` state's visit counter resets to 0. This allows `loop_inner` to be entered up to 3 times per outer iteration without ever exceeding its `max_visits` limit across the entire workflow run.

**State history (context.json):**
```json
{
  "stateHistory": [
    {"state": "loop_outer", "enteredAt": "2026-04-02T10:00:00Z"},
    {"state": "loop_inner", "enteredAt": "2026-04-02T10:00:01Z"},
    {"state": "loop_inner", "enteredAt": "2026-04-02T10:00:02Z"},
    {"state": "loop_inner", "enteredAt": "2026-04-02T10:00:03Z"},
    {"state": "loop_outer", "enteredAt": "2026-04-02T10:00:04Z"},
    {"state": "loop_inner", "enteredAt": "2026-04-02T10:00:05Z"},
    {"state": "loop_inner", "enteredAt": "2026-04-02T10:00:06Z"}
  ]
}
```

In this example:
- `loop_outer` resets the visit counter for `loop_inner` each time it is entered
- `loop_inner` can be visited 3 times per `loop_outer` iteration without hitting the max_visits limit
- Without this feature, the 4th entry to `loop_inner` would fail regardless of which `loop_outer` iteration it occurs in

## Test Plan

### Unit tests (`__tests__/unit/runner/runner.maxvisits.test.ts`)

Add new test case to the existing max_visits test file:

**Test case:** "reset_max_visits resets visit counter for specified states"
  - Setup: 
    - Create a state machine with three states: `outer`, `inner`, and `end`
    - `outer` has `reset_max_visits: ["inner"]` and routes to `inner`
    - `inner` has `max_visits: { count: 2 }` and routes back to `outer` on first pass, then to `end` on second pass
    - Mock all command runners to return consistent outcomes
  - Act: 
    - Call `runner.run()` and trace the execution path
    - Verify that `inner` can be visited 2 times, then `outer` is revisited, then `inner` can be visited 2 more times
  - Assert: 
    - No max_visits error is thrown
    - `outer` appears in state history at least twice
    - Final state is `end`
    - Visit counts are correctly managed (reset after outer entry)

**Test case:** "reset_max_visits fails if target state does not exist"
  - Setup: 
    - Create a workflow where a state has `reset_max_visits: ["nonexistent_state"]`
    - This should be caught during validation (before runner execution)
  - Act: 
    - Call workflow loading/validation
  - Assert: 
    - An error is thrown with message indicating the state does not exist (fail-fast)

### Integration tests (`__tests__/integration/`)

Create a new test file: `__tests__/integration/reset_max_visits.test.ts`

**Test case:** "reset_max_visits resets counter across multiple outer iterations with nested loops"

```typescript
// Sketch of the test structure
jest.mock('child_process', () => ({ spawn: jest.fn() }));
const { spawn } = require('child_process');

describe('reset_max_visits integration', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = createTmpWorkspace();
  });

  afterEach(() => {
    cleanupTmpWorkspace(tmpDir);
    cleanupRailiEnvVars();
    spawn.mockReset();
  });

  it('allows inner loop to reset max_visits on each outer iteration', async () => {
    writeWorkflow(tmpDir, `
initial: outer
states:
  outer:
    type: command
    command: echo "outer"
    reset_max_visits:
      - inner
    on:
      PASSED: inner
      FAILED: end
  
  inner:
    type: command
    command: echo "inner"
    max_visits:
      count: 2
    on:
      PASSED: inner_check
      FAILED: end
  
  inner_check:
    type: engine
    on:
      PASSED: outer
  
  end:
    type: engine
`);
    writeAgentRegistry(tmpDir, {});
    writeScriptRegistry(tmpDir, {});

    let visitCount = 0;
    spawn.mockImplementation((cmd: string, args: string[]) => {
      if (cmd === 'sh') {
        visitCount++;
        // Simulate: 1st inner runs, 2nd inner runs, 3rd triggers branch to end
        if (args[1] === 'echo "inner"' && visitCount <= 2) {
          return fakeChild('inner\n', '', 0);
        }
        if (args[1] === 'echo "outer"') {
          return fakeChild('outer\n', '', 0);
        }
      }
      return fakeChild('', '', 0);
    });

    await runCommand(tmpDir, 'clean', {});

    const ctx = loadContext(tmpDir);
    // Verify we went through outer → inner (twice) → inner_check → outer → inner (twice) → end
    expect(ctx.stateHistory.length).toBeGreaterThan(5);
    expect(ctx.stateHistory[ctx.stateHistory.length - 1].state).toBe('end');
  });
});
```

## Acceptance Criteria

- [ ] `reset_max_visits` field is added to `StateConfig` interface as optional array of strings
- [ ] Schema definition added to `StateConfigSchema` with correct type and description
- [ ] Visit counter reset logic implemented in `Runner.enterState()` method using `this.visitCounts.delete()`
- [ ] Validation in `stateValidator.ts` ensures all referenced state IDs exist (fail-fast on startup)
- [ ] Unit test added to `runner.maxvisits.test.ts` covering reset behavior and error cases
- [ ] Integration test `reset_max_visits.test.ts` created and passing, demonstrating multi-level looping
- [ ] Workflow with nested inner/outer loops can execute without max_visits interference
- [ ] On workflow resume (continue mode), visit counters are naturally reset since they are not persisted
- [ ] Documentation in `documentation/states.md` updated with `reset_max_visits` example (if docs are within scope)
