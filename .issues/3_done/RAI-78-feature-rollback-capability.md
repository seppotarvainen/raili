# RAI-78: Add ability to roll back steps before continuing

**Type:** feature

## Description

Add a `--rollback` flag to `raili run` to enable users to remove entries from the workflow context history and resume execution from a previous state. Currently, users must manually edit `.raili/<workflow>/context.json` to recover from workflow failures. This feature will automate that recovery by supporting three rollback modes: by count (e.g. `--rollback=3`), by single step (`--rollback=1`), and by state ID (e.g. `--rollback=code`). Rollback modifies the persisted context by removing history entries, preserving exposed variables as-is.

## Documentation References

- documentation/usage/run.md

## Code References

- src/cli.ts (parseRunArgs, CLI entry point)
- src/types.ts (RailiRunArgs interface)
- src/run.ts (runCommand function signature)
- src/context/context.ts (loadContext, saveContext, getCurrentState, WorkflowContext type)
- src/runner/runner.ts (Runner class initialization with context)

## Implementation Plan

1. **src/types.ts** — Add optional `rollback?: string | number` field to `RailiRunArgs` interface
2. **src/cli.ts** — Parse `--rollback` flag in `parseRunArgs()` function. Support formats: `--rollback=1`, `--rollback=3`, `--rollback=code`. Normalize and return as string in `RailiRunArgs.rollback` (will be parsed/validated later)
3. **src/context/context.ts** — Add new function `rollbackHistory(context: WorkflowContext, rollbackArg: string): WorkflowContext` that:
   - Accepts rollback specification (count as string `'1'`, `'3'` or state ID like `'code'`)
   - For numeric count: removes the last N entries from `stateHistory`
   - For state ID: finds the last occurrence of that state in history and removes all entries after it (keeping that state's entry)
   - Throws error if rollback count exceeds history length: `"Cannot rollback N steps: history only has M entries"`
   - Throws error if state ID not found: `"State 'code' not found in history"`
   - Returns mutated context (new reference with truncated stateHistory)
4. **src/run.ts** — In `runCommand()` function, after loading context (around line 128):
   - Add parameter `rollback?: string | number` to function signature
   - Before entering the run loop, check if `rollback` is provided in 'continue' mode
   - If provided, call `rollbackHistory()` and overwrite context
   - Save the rolled-back context to disk immediately
   - Continue normal execution from the newly current state
5. **src/cli.ts** — Pass `rollback` from parsed `RailiRunArgs` to `runCommand()` call (around line 230-235 area, need to verify exact location)

## Examples

### Example: Roll back 1 step and continue
```bash
# Workflow fails at 'merge' state, history: [start, analyze, review, merge]
# After rollback, history: [start, analyze, review]
# Next run resumes from 'review'
raili run --rollback=1 --continue
```

### Example: Roll back 3 steps
```bash
# History: [init, fetch, validate, transform, upload, fail]
# After rollback=3, history: [init, fetch, validate]
# Next run resumes from 'validate'
raili run --rollback=3
```

### Example: Roll back to a specific state ID
```bash
# History: [start, analyze, fix1, fix2, fix3, failed]
# After rollback to 'analyze', history: [start, analyze]
# Next run resumes from 'analyze'
raili run --rollback=analyze --continue
```

### Expected behavior / output

When `--rollback` is provided:
1. CLI parses the flag and passes it to `runCommand()`
2. `runCommand()` loads context and applies rollback:
   - Modifies `context.stateHistory` to remove entries
   - Preserves `context.vars`, `context.approvals`, `context.feedbacks` (no changes to exposed vars)
   - Immediately saves modified context to `.raili/<workflow>/context.json`
3. Runner continues from new current state (last entry in modified history)
4. No state is re-entered; execution simply resumes from the preserved state

Example `context.json` before rollback (history has 5 entries):
```json
{
  "stateHistory": [
    {"state": "start", "enteredAt": "2026-04-23T08:00:00Z"},
    {"state": "analyze", "enteredAt": "2026-04-23T08:01:00Z"},
    {"state": "review", "enteredAt": "2026-04-23T08:02:00Z"},
    {"state": "fix", "enteredAt": "2026-04-23T08:03:00Z"},
    {"state": "merge", "enteredAt": "2026-04-23T08:04:00Z"}
  ],
  "vars": {"ticket_id": "PROJ-123"},
  "approvals": {},
  "feedbacks": {}
}
```

After `raili run --rollback=2 --continue`, context.json becomes:
```json
{
  "stateHistory": [
    {"state": "start", "enteredAt": "2026-04-23T08:00:00Z"},
    {"state": "analyze", "enteredAt": "2026-04-23T08:01:00Z"},
    {"state": "review", "enteredAt": "2026-04-23T08:02:00Z"}
  ],
  "vars": {"ticket_id": "PROJ-123"},
  "approvals": {},
  "feedbacks": {}
}
```

Next `raili run` without `--rollback` resumes from `review` state.

## Test Plan

### Unit tests (`__tests__/unit/`)

**File:** `__tests__/unit/context.test.ts` (add to existing file)

- **Test case: "rollbackHistory removes N entries from end"**
  - Setup: Create context with 5 state history entries
  - Act: Call `rollbackHistory(context, '2')`
  - Assert: Returned context has 3 entries; last state is 'review'; vars unchanged

- **Test case: "rollbackHistory rolls back to specific state ID"**
  - Setup: Create context with states [start, analyze, review, fix, merge]
  - Act: Call `rollbackHistory(context, 'analyze')`
  - Assert: Returned context has [start, analyze]; last state is 'analyze'

- **Test case: "rollbackHistory throws on invalid count"**
  - Setup: Create context with 2 entries
  - Act: Call `rollbackHistory(context, '5')`
  - Assert: Throws error matching "Cannot rollback 5 steps: history only has 2 entries"

- **Test case: "rollbackHistory throws on missing state ID"**
  - Setup: Create context with [start, analyze, fix]
  - Act: Call `rollbackHistory(context, 'nonexistent')`
  - Assert: Throws error matching "State 'nonexistent' not found in history"

### Unit tests (`__tests__/unit/`)

**File:** `__tests__/unit/cli.test.ts` (add to existing file)

- **Test case: "parseRunArgs parses --rollback=N flag"**
  - Setup: Parse `['run', '--rollback=3']`
  - Act: Call `parseRunArgs()`
  - Assert: Result has `rollback: '3'`

- **Test case: "parseRunArgs parses --rollback=STATE_ID flag"**
  - Setup: Parse `['run', '--rollback=analyze']`
  - Act: Call `parseRunArgs()`
  - Assert: Result has `rollback: 'analyze'`

- **Test case: "parseRunArgs with --rollback forces continue mode"**
  - Setup: Parse `['run', '--rollback=1']`
  - Act: Call `parseRunArgs()`
  - Assert: Result has `rollback: '1'` and `mode: 'continue'`

### Integration tests (`__tests__/integration/`)

Follow the established patterns from `__tests__/integration/testUtils.ts`:

- Use `createTmpWorkspace()` to create a sandboxed temp directory
- Use `writeWorkflow(tmp, yamlContent)` to write `.raili/main/workflow.yaml`
- Use `writeAgentRegistry(tmp, {...})` and `writeScriptRegistry(tmp, {...})`
- Mock `child_process` globally: `jest.mock('child_process', () => ({ spawn: jest.fn() }));`
- Use `fakeChild(stdout, stderr, exitCode)` to simulate process output
- Use `cleanupRailiEnvVars()` in `afterEach` to clean up env vars
- Use `loadContext(tmp)` to assert final state

**File:** `__tests__/integration/rollback.integration.test.ts` (new file)

**Test case: "Rollback removes N entries and resumes correctly"**
```typescript
// Create workflow: start → analyze → review → terminal
writeWorkflow(tmp, `
initial: start
states:
  start:
    type: agent
    agent: test_agent
    prompt: "Start"
    on:
      PASSED: "analyze"
  analyze:
    type: agent
    agent: test_agent
    prompt: "Analyze"
    on:
      PASSED: "review"
  review:
    type: agent
    agent: test_agent
    prompt: "Review"
    on:
      PASSED: "done"
  done:
    type: engine
`);
writeAgentRegistry(tmp, { test_agent: { path: './agents/test.md' } });
writeScriptRegistry(tmp, {});
writeAgentFile(tmp, 'agents/test.md', 'Agent');

spawn.mockImplementation(() => fakeChild('PASSED', '', 0));

// Run twice to build history: start → analyze → review → done
await runCommand(tmp, 'clean', {});
await runCommand(tmp, 'continue', {}, undefined, false, undefined);

// Verify history has 4 entries
let ctx = loadContext(tmp);
expect(ctx.stateHistory.length).toBe(4);
expect(ctx.stateHistory[3].state).toBe('done');

// Rollback 2 steps: should go from [start, analyze, review, done] → [start, analyze, review]
await runCommand(tmp, 'continue', {}, undefined, false, 2);

// Verify history truncated and last state is review
ctx = loadContext(tmp);
expect(ctx.stateHistory.length).toBe(3);
expect(ctx.stateHistory[2].state).toBe('review');
```

**Test case: "Rollback to specific state ID"**
```typescript
// Similar setup as above, run to build history [start, analyze, review, done]
// Rollback to 'analyze'
await runCommand(tmp, 'continue', {}, undefined, false, 'analyze');

// Verify only [start, analyze] remains
ctx = loadContext(tmp);
expect(ctx.stateHistory.length).toBe(2);
expect(ctx.stateHistory[1].state).toBe('analyze');
```

**Test case: "Rollback throws on invalid count"**
```typescript
// Setup: build history with 2 entries [start, analyze]
// Attempt rollback with count > 2
expect(async () => {
  await runCommand(tmp, 'continue', {}, undefined, false, 5);
}).rejects.toThrow('Cannot rollback 5 steps: history only has 2 entries');
```

**Test case: "Rollback throws on missing state ID"**
```typescript
// Setup: build history [start, analyze, review]
// Attempt rollback to non-existent state
expect(async () => {
  await runCommand(tmp, 'continue', {}, undefined, false, 'nonexistent');
}).rejects.toThrow("State 'nonexistent' not found in history");
```

**Test case: "Rollback preserves vars and other context fields"**
```typescript
// Setup: run with --var ticket_id=TICKET-123, build history
// Manually add approval/feedback to context before rollback
// Rollback 1 step
// Assert: vars unchanged, approvals/feedbacks unchanged
ctx = loadContext(tmp);
expect(ctx.vars.ticket_id).toBe('TICKET-123');
expect(ctx.approvals).toEqual({ /* original values */ });
expect(ctx.feedbacks).toEqual({ /* original values */ });
```

## Acceptance Criteria

- [ ] `parseRunArgs()` in `src/cli.ts` parses `--rollback` flag in formats `--rollback=N` (numeric), `--rollback=STATE_ID` (string), and returns as string in `RailiRunArgs.rollback`
- [ ] `--rollback` flag forces 'continue' mode (as if `--continue` was supplied)
- [ ] `rollbackHistory()` function in `src/context/context.ts` removes N entries from history end when given numeric string, removes entries after matching state ID when given state name
- [ ] `rollbackHistory()` throws descriptive error if count exceeds history length
- [ ] `rollbackHistory()` throws descriptive error if state ID not found in history
- [ ] `rollbackHistory()` preserves `vars`, `approvals`, and `feedbacks` (only modifies `stateHistory`)
- [ ] `runCommand()` applies rollback to context immediately after loading (before runner starts)
- [ ] Modified context is saved to `.raili/<workflow>/context.json` before execution continues
- [ ] Next `raili run` without `--rollback` resumes from the new current state (last entry in truncated history)
- [ ] All existing tests pass (no breaking changes to default behavior when `--rollback` not provided)
- [ ] Integration tests validate full control flow: build history, rollback, verify persisted context, resume execution
