# RAI-67: Fix required context.json for new workflows

**Type:** fix

## Description
Currently, `loadContext()` throws an error when a named workflow is provided and context.json doesn't exist. This prevents users from running a new workflow for the first time. The fix ensures that missing context.json files are handled gracefully by creating a fresh context on the fly, allowing clean runs to proceed without requiring context.json to pre-exist.

## Documentation References
- None

## Code References
- src/context/context.ts (loadContext)
- src/context/runLog.ts (appendRunLog - error handling can be simplified)
- src/cli.ts (promptRunMode - calls loadContext early)

## Implementation Plan

1. **src/context/context.ts** — Modify `loadContext()` to return an empty context instead of throwing an error when context.json doesn't exist. Remove the `if (workflowArg)` error branch (lines 18-22) so all missing context.json cases return `{ stateHistory: [] }`.

2. **src/context/runLog.ts** — Simplify `appendRunLog()` by removing the try-catch block (lines 32-37) since `loadContext()` will no longer throw. Call `loadContext()` directly without error handling.

3. **__tests__/unit/context/context.loadContext.test.ts** — Update or remove the test that expects an error when `workflowArg` is provided and context.json doesn't exist. Add a test verifying that `loadContext()` returns an empty context for missing files regardless of `workflowArg`.

4. **__tests__/unit/cli/cli.promptRunMode.test.ts** — Update tests that currently expect errors. When context.json is missing for a new workflow, `promptRunMode()` should return `'clean'` (since `getCurrentState()` will be null).

## Examples

### Before behavior (fails)
```bash
raili run --workflow my_new_workflow
# Error: Missing context.json for workflow 'my_new_workflow'. Cannot run without an existing context.
```

### After behavior (succeeds)
```bash
raili run --workflow my_new_workflow
# Creates fresh context.json automatically, prompts for inputs, starts the workflow
```

### Code change in context.ts
```typescript
// Before
if (!fs.existsSync(contextPath)) {
  if (workflowArg) {
    throw new Error(
      `Missing context.json for workflow '${workflowArg}'. Cannot run without an existing context.`,
    );
  }
  return { stateHistory: [] };
}

// After
if (!fs.existsSync(contextPath)) {
  return { stateHistory: [] };
}
```

## Test Plan

### Unit tests (`__tests__/unit/`)

**File:** `__tests__/unit/context/context.loadContext.test.ts`

- **Test case:** "returns empty context when context.json doesn't exist for named workflow"
  - Setup: Mock `resolveWorkflowDir()` to return `/repo/.raili/custom`, mock `existsSync()` to return false
  - Act: Call `loadContext(cwd, 'custom')`
  - Assert: Result equals `{ stateHistory: [], vars: {}, approvals: {}, feedbacks: {} }`

- **Test case:** "returns empty context when context.json doesn't exist for default workflow"
  - Setup: Mock `resolveWorkflowDir()` to return `/repo/.raili/main`, mock `existsSync()` to return false
  - Act: Call `loadContext(cwd)` (no workflowArg)
  - Assert: Result equals `{ stateHistory: [], vars: {}, approvals: {}, feedbacks: {} }`

**File:** `__tests__/unit/cli/cli.promptRunMode.test.ts`

- **Test case:** "returns 'clean' when workflow exists but context.json is missing"
  - Setup: Mock `loadContext()` to return `{ stateHistory: [] }`, mock `getCurrentState()` to return null
  - Act: Call `promptRunMode(cwd, 'my_workflow')`
  - Assert: Result equals `'clean'` (no error thrown, no prompt shown)

### Integration tests (`__tests__/integration/`)

- **Test case:** "clean run for new named workflow with missing context.json"
  - Setup: Create tmp workspace, write workflow YAML, write registries, **do NOT create context.json**
  - Act: Call `runCommand(tmp, 'clean', {})` with a custom workflow
  - Assert: 
    - No error thrown
    - Context created automatically at `.raili/<workflow>/context.json`
    - Workflow executes and completes successfully
    - Final state is persisted in context.json

Example sketch:
```typescript
const tmp = createTmpWorkspace();
writeWorkflow(tmp, `initial: start\nstates:\n  start:\n    type: engine`);
writeAgentRegistry(tmp, {});
writeScriptRegistry(tmp, {});
// Explicitly do NOT write context.json — test should still work

await runCommand(tmp, 'clean', {}, undefined, false);

const contextPath = path.join(tmp, '.raili', 'main', 'context.json');
expect(fs.existsSync(contextPath)).toBe(true);
const ctx = loadContext(tmp);
expect(ctx.stateHistory.length).toBeGreaterThan(0);
```

## Acceptance Criteria
- [ ] `loadContext()` no longer throws an error when context.json is missing, regardless of whether `workflowArg` is provided
- [ ] Missing context.json returns `{ stateHistory: [], vars: {}, approvals: {}, feedbacks: {} }`
- [ ] `promptRunMode()` returns `'clean'` when context.json is missing instead of throwing an error
- [ ] `appendRunLog()` in runLog.ts no longer needs error handling and calls `loadContext()` directly
- [ ] All existing unit tests pass (updated to reflect new behavior)
- [ ] New workflow runs (named or default) succeed even when context.json doesn't initially exist
- [ ] Integration test verifies context.json is created on the fly during clean runs
