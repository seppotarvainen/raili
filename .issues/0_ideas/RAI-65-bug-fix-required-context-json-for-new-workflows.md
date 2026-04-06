# RAI-65: Fix required context.json for new workflows

**Type:** bug

## Description
Currently, `loadContext()` throws an error when attempting a `continue` run on a named workflow that doesn't have a `context.json` file yet (a fresh start). The error message states: "Missing context.json for workflow '<name>'. Cannot run without an existing context." This is incorrect behavior — `context.json` should not be required for new workflows. Instead, it should be created on-the-fly with an empty state history.

The fix allows workflows to start fresh without a pre-existing `context.json` file, supporting the intended use case where users can run a workflow for the first time in either `clean` mode (which already works) or `continue` mode (which currently fails).

## Documentation References
- documentation/usage/run.md
- documentation/architecture/infrastructure.md

## Code References
- src/context/context.ts (loadContext function)
- src/cli.ts (promptRunMode function)
- __tests__/unit/context/context.loadContext.test.ts
- __tests__/unit/cli/cli.promptRunMode.test.ts

## Implementation Plan

1. **src/context/context.ts** — Modify `loadContext()` function (lines 12-24)
   - Remove the logic that throws when `workflowArg` is provided and `context.json` is missing
   - Always return `{ stateHistory: [] }` when context.json doesn't exist, regardless of whether `workflowArg` is provided
   - Update the JSDoc comment to reflect the new behavior

2. **__tests__/unit/context/context.loadContext.test.ts** — Update unit test (add new test case)
   - Add a new test case: "returns empty context when context.json does not exist with workflowArg"
   - Verify that `loadContext(cwd, 'named-workflow')` returns `{ stateHistory: [] }` instead of throwing

3. **__tests__/unit/cli/cli.promptRunMode.test.ts** — Update CLI test (remove/modify obsolete test cases)
   - Remove the test case "throws when workflow/context is missing for provided workflow" (lines 14-22)
   - Remove the test case "throws when context.json is missing for an existing workflow directory" (lines 31-39)
   - These tests were asserting error behavior that is now incorrect
   - The remaining test case "returns clean when workflow exists but has no current state" already covers the correct behavior

## Examples

### Before (broken behavior)
```typescript
// Fresh start on a named workflow — incorrectly throws
await runCommand('/my/project', 'continue', {}, 'dev-workflow');
// Error: Missing context.json for workflow 'dev-workflow'. Cannot run without an existing context.
```

### After (fixed behavior)
```typescript
// Fresh start on a named workflow — creates context.json on-the-fly
await runCommand('/my/project', 'continue', {}, 'dev-workflow');
// Succeeds: context.json is created with empty state history
```

### Expected behavior / output
- When `continue` mode is used on a workflow without `context.json`, the engine automatically creates an empty context and proceeds with execution
- The context is persisted to disk after the first state is entered (as normal)
- No error is thrown; the workflow executes as if it were a fresh start

## Test Plan

### Unit tests (`__tests__/unit/`)

**File:** `__tests__/unit/context/context.loadContext.test.ts`

**Test case 1:** "returns empty context when context.json does not exist (default workflow)"
- Setup: Mock filesystem to report context.json does not exist (no workflowArg)
- Act: Call `loadContext(cwd)` with no workflowArg
- Assert: Returns `{ stateHistory: [] }`

**Test case 2:** "returns empty context when context.json does not exist (named workflow)" *(NEW)*
- Setup: Mock filesystem to report context.json does not exist; use `workflowArg = 'dev'`
- Act: Call `loadContext(cwd, 'dev')`
- Assert: Returns `{ stateHistory: [] }` (no error thrown)

**File:** `__tests__/unit/cli/cli.promptRunMode.test.ts`

**Test case 1 (REMOVE):** "throws when workflow/context is missing for provided workflow" (lines 14-22)
- This test asserts the broken behavior and must be removed

**Test case 2 (REMOVE):** "throws when context.json is missing for an existing workflow directory" (lines 31-39)
- This test asserts the broken behavior and must be removed

**Test case 3 (KEEP):** "returns clean when workflow exists but has no current state"
- This test already covers the correct behavior and should remain

### Integration tests (`__tests__/integration/`)

**Test case:** "continue run succeeds on fresh named workflow without context.json"

```typescript
// Setup
const tmp = createTmpWorkspace();
writeWorkflow(tmp, `
initial: start
states:
  start:
    type: engine
`, 'dev'); // Write to .raili/dev/ instead of .raili/main/
writeAgentRegistry(tmp, {});
writeScriptRegistry(tmp, {});

// Mock spawn (no subprocess calls needed for engine state)
jest.mock('child_process', () => ({ spawn: jest.fn() }));
const { spawn } = require('child_process');
spawn.mockReturnValue(fakeChild('', '', 0));

// Act: Run continue mode on fresh workflow (no context.json exists)
await runCommand(tmp, 'continue', {}, 'dev');

// Assert: Execution succeeded and context.json was created
const ctx = loadContext(tmp, 'dev');
expect(ctx.stateHistory.length).toBeGreaterThan(0);
expect(ctx.stateHistory[0].state).toBe('start');
```

## Acceptance Criteria
- [ ] `loadContext()` no longer throws when `context.json` is missing, regardless of `workflowArg`
- [ ] A `continue` run on a fresh named workflow creates an empty context on-the-fly
- [ ] Unit test added verifying empty context is returned for named workflows without context.json
- [ ] Obsolete CLI tests removed (the two tests asserting error behavior)
- [ ] Integration test added covering fresh named workflow start in continue mode
- [ ] All existing tests pass (no regression in other areas)
