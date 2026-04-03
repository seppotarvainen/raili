## Implementation Completed

✅ **1. src/workflow/workflowLoader.ts** (lines 143-169) — Added continue support to group state flattening
   - Added `(subCfg as any).continue` to validation check (line 151)
   - Updated error message to include `continue` (line 154)
   - Added inheritance logic: `cfgCopy.continue = (stateCfg as any).continue` (lines 167-169)

✅ **2. __tests__/unit/workflow/workflowLoader.test.ts** (lines 472-557) — Added unit tests
   - Test: "inherits continue field from parent group to out state"
   - Test: "throws when out state defines continue (not inherited)"

✅ **3. __tests__/integration/group.integration.test.ts** (lines 420-472) — Added integration test
   - Test: "routes via continue when configured on parent group"
   - Verifies complete workflow execution with group continue transitions

## Examples

### Example workflow YAML with group continue

```yaml
initial: setup
states:
  setup:
    type: engine
    on:
      PASSED: process_group
  process_group:
    type: group
    group: ./sub.yaml
    continue: cleanup        # Continue unconditionally after sub-workflow exits
  cleanup:
    type: engine
```

Sub-workflow (`./sub.yaml`):
```yaml
states:
  analyze:
    type: agent
    agent: analyzer
    on:
      PASSED: review
  review:
    type: agent
    agent: reviewer
    out: true               # Exits sub-workflow; will inherit 'continue: cleanup' from parent
```

### Expected behavior / output

When the workflow runs:
1. `setup` state enters and routes to `process_group`
2. `process_group` (group proxy) skips to `process_group.analyze`
3. `process_group.analyze` executes and routes to `process_group.review`
4. `process_group.review` (the out state) executes and inherits `continue: cleanup` from parent
5. The continue routing takes effect, routing to `cleanup` (bypassing the need for outcome-based routing)
6. Final state history: `[setup, process_group, process_group.analyze, process_group.review, cleanup]`

Without this fix, step 5 would incorrectly treat `process_group.review` as a terminal state, causing the workflow to stop prematurely.

## Test Plan

### Unit tests (`__tests__/unit/`)

**File:** `__tests__/unit/workflow/workflowLoader.test.ts`

**Test case:** "inherits continue field from parent group to out state"
- Setup: Create a mock workflow config with:
  - A group state with `continue: "next_state"`
  - A sub-workflow with an `out: true` state
- Act: Call `loadWorkflowConfig()` to process the group and flatten states
- Assert: 
  - The flattened `out:true` state should have `continue: "next_state"` copied to it
  - The state machine transitions should include the continue target

**Test case:** "validates that out state cannot define continue"
- Setup: Create a sub-workflow where the `out:true` state also defines `continue`
- Act: Call `loadWorkflowConfig()` 
- Assert: Should throw an error indicating that `out:true` states must not define routing (including continue)

### Integration tests (`__tests__/integration/`)

**Test case:** "routes via continue transition when configured on parent group"

```typescript
// Workflow setup: group state with continue
writeWorkflow(tmpDir, `
initial: setup
states:
  setup:
    type: engine
    on:
      PASSED: process_group
  process_group:
    type: group
    group: ./sub.yaml
    continue: cleanup       # This continue should apply to out state
  cleanup:
    type: engine
`);

// Sub-workflow with out state
writeSubWorkflow(tmpDir, 'main', 'sub.yaml', `
states:
  work:
    type: agent
    agent: test_agent
    out: true             # Inherits continue: cleanup from parent
`);

writeAgentRegistry(tmpDir, { test_agent: { path: './agents/test.agent.md' } });
writeScriptRegistry(tmpDir, {});
writeAgentFile(tmpDir, 'agents/test.agent.md', 'Agent');

// Mock spawn to return success
spawn.mockImplementation((cmd: string) => {
  if (cmd === 'copilot') return fakeChild('work output', '', 0);
  return fakeChild('', '', 0);
});

// Run workflow
await runCommand(tmpDir, 'clean', {});

// Assert: State history should include setup, proxy, work, and cleanup
// Final state should be 'cleanup', not 'process_group.work'
const ctx = loadContext(tmpDir);
const states = ctx.stateHistory.map((e) => e.state);
expect(states).toEqual(['setup', 'process_group', 'process_group.work', 'cleanup']);
expect(states[states.length - 1]).toBe('cleanup');
```

## Acceptance Criteria

- [ ] `workflowLoader.ts` validation check includes `continue` in the list of forbidden fields for `out:true` states
- [ ] Error message for invalid `out:true` state routing explicitly mentions `continue` 
- [ ] `out:true` states inherit the parent group's `continue` field during flattening
- [ ] Unit tests verify that continue inheritance works correctly
- [ ] Unit tests verify that continue on an `out:true` state is rejected during validation
- [ ] Integration test confirms group states with continue transitions execute correctly
- [ ] All existing tests continue to pass
- [ ] The fix is backward compatible (no breaking changes to existing workflows without continue in groups)
