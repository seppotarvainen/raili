# RAI-77: Add ability to run only "next steps"

**Type:** feature

## Description

Add a `--next` CLI flag to allow running only the next N steps of a workflow without executing the entire state machine. With `raili run --next=2`, users can run only the next 2 steps; `raili run --next` runs only the next 1 step. This is useful when iterating on specific workflow steps and testing changes without running the full workflow. When `--next` is defined, always use continue mode. If no `context.json` exists, start from the workflow's initial state and run only the specified number of steps.

## Documentation References
- `documentation/cli/run.md` (if exists)

## Code References
- `src/cli.ts` (parseRunArgs, main)
- `src/types.ts` (RailiRunArgs interface)
- `src/run.ts` (runCommand function signature)
- `src/runner/runner.ts` (Runner.run() main loop)

## Implementation Plan

1. **src/types.ts** — Extend `RailiRunArgs` interface to add optional `next?: number` field to hold the parsed `--next` flag value

2. **src/cli.ts:parseRunArgs()** — Add `--next` option definition (string or boolean type for flexibility) to parse the flag as a number or boolean (treat bare `--next` as 1):
   - If `--next` is present without value, set to 1
   - If `--next=N` is present, parse N as number
   - Add to returned `RailiRunArgs` object as `next` field
   - When `next` is defined, force `mode = 'continue'` (ignore `--clean` and `--continue` flags)

3. **src/run.ts:runCommand()** — Add `nextSteps?: number` parameter after existing parameters. Pass it through to `Runner` constructor

4. **src/types.ts:RunnerConfig** — Add optional `nextSteps?: number` field to store the step limit in the runner

5. **src/runner/runner.ts:Runner class** — Store `nextSteps` from config as a private field. In the `run()` method main loop (line ~654), add a step counter that tracks how many states have been executed (entered but not skipped). When `nextSteps` is defined and the counter reaches that limit, break from the loop and treat the current state as terminal (set `success` flag appropriately)

6. **src/cli.ts:main()** — When calling `runCommand()` (around line 208), pass the `next` value from parsed args as `nextSteps` parameter. When `--next` is defined, override the determined mode to always be `'continue'`

## Examples

### Example workflow YAML
```yaml
initial: analyze
states:
  analyze:
    type: agent
    agent: code_reviewer
    prompt: "Review the code"
    transitions:
      approve: test
      reject: fix

  test:
    type: script
    script: run_tests
    on:
      PASSED: merge
      FAILED: fix

  fix:
    type: engine
    continue: analyze

  merge:
    type: engine
```

### Expected behavior

**Scenario 1: Run next 2 steps with existing context**
```bash
# First run: full workflow
$ raili run
# Executes: analyze → test → merge (3 states)

# Second run: next 2 steps only
$ raili run --next=2
# Continues from 'merge' (last state from first run)
# If 'merge' is terminal, restarts from 'analyze'
# Executes: analyze → test (stops after 2 states)
# Context updated with only these 2 new entries
```

**Scenario 2: Run next 1 step from clean state**
```bash
$ raili run --next
# No context.json exists or using continue mode
# Starts from initial state 'analyze'
# Executes only: analyze (1 state)
# Stops even though 'analyze' has transitions
```

**Scenario 3: Verify behavior with approval states**
```bash
# Workflow with approval state
initial: review
states:
  review:
    type: engine
    approval:
      question: "Approve?"
      PASSED: merge
      FAILED: fix
  merge:
    type: engine

# Run with --next=1
$ raili run --next=1
# Executes only 'review' state with approval prompt
# Even though approval has routing, stops after 1 step
```

### Expected context.json behavior

After `raili run --next=2`, the `stateHistory` array should contain exactly 2 new entries (or fewer if terminal state reached earlier). The `success` flag on the final executed state should reflect normal terminal logic (terminal states without explicit `success` config get `null`).

```json
{
  "stateHistory": [
    { "state": "analyze", "enteredAt": "2026-04-16T07:36:43Z" },
    { "state": "test", "enteredAt": "2026-04-16T07:36:45Z" }
  ],
  "vars": { "workflow": "main" }
}
```

## Test Plan

### Unit tests (`__tests__/unit/`)

- **File:** `__tests__/unit/cli.test.ts`
- **Test case:** "parseRunArgs parses --next=N correctly"
  - Setup: Call `parseRunArgs(['--next=3'])`
  - Act: Check returned object
  - Assert: `result.next === 3` and `result.mode === 'continue'`

- **Test case:** "parseRunArgs treats bare --next as 1"
  - Setup: Call `parseRunArgs(['--next'])`
  - Act: Check returned object
  - Assert: `result.next === 1` and `result.mode === 'continue'`

- **Test case:** "--next overrides --clean flag to use continue mode"
  - Setup: Call `parseRunArgs(['--next=2', '--clean'])`
  - Act: Check returned object
  - Assert: `result.mode === 'continue'` (not 'clean')

- **File:** `__tests__/unit/runner.test.ts`
- **Test case:** "Runner stops after executing nextSteps number of states"
  - Setup: Mock 3-state linear workflow, create Runner with `nextSteps: 2`
  - Act: Call `runner.run()`
  - Assert: `stateHistory.length === 2` (or fewer if terminal reached)

- **Test case:** "Runner breaks loop when nextSteps limit reached mid-execution"
  - Setup: Workflow with branching; mock runner with `nextSteps: 1`
  - Act: Call `runner.run()`
  - Assert: Only 1 state in final stateHistory

### Integration tests (`__tests__/integration/`)

Follow the established patterns from `__tests__/integration/testUtils.ts`:

- Use `createTmpWorkspace()` to create sandboxed temp directory
- Use `writeWorkflow()`, `writeAgentRegistry()`, `writeScriptRegistry()`
- Mock `child_process` globally with `jest.mock()`
- Use `fakeChild()` to simulate process output
- Use `loadContext()` to assert final state
- Use `cleanupRailiEnvVars()` in `afterEach`

**Test case:** "Run next 2 steps from clean state in continue mode"
```typescript
// Setup
const tmp = createTmpWorkspace();
writeWorkflow(tmp, `
initial: s1
states:
  s1:
    type: engine
    on:
      PASSED: s2
  s2:
    type: engine
    on:
      PASSED: s3
  s3:
    type: engine
`);
writeAgentRegistry(tmp, {});
writeScriptRegistry(tmp, {});

// Act
await runCommand(tmp, 'continue', {}, undefined, false, 2); // nextSteps: 2

// Assert
const ctx = loadContext(tmp);
expect(ctx.stateHistory.length).toBe(2);
expect(ctx.stateHistory[0].state).toBe('s1');
expect(ctx.stateHistory[1].state).toBe('s2');
// s3 should NOT be executed because limit reached
```

**Test case:** "Run next 1 step (bare --next) and verify terminal behavior"
```typescript
// Setup
const tmp = createTmpWorkspace();
writeWorkflow(tmp, `
initial: analyze
states:
  analyze:
    type: engine
    on:
      PASSED: done
  done:
    type: engine
    success: true
`);
writeAgentRegistry(tmp, {});
writeScriptRegistry(tmp, {});

// Act
await runCommand(tmp, 'continue', {}, undefined, false, 1); // nextSteps: 1

// Assert
const ctx = loadContext(tmp);
expect(ctx.stateHistory.length).toBe(1);
expect(ctx.stateHistory[0].state).toBe('analyze');
// 'done' should NOT be executed
// 'analyze' should NOT be marked as terminal (has routing)
```

**Test case:** "Resume workflow and run next 2 steps continues from last state"
```typescript
// Setup
const tmp = createTmpWorkspace();
writeWorkflow(tmp, `
initial: s1
states:
  s1:
    type: engine
    on:
      PASSED: s2
  s2:
    type: engine
    on:
      PASSED: s3
  s3:
    type: engine
`);
writeAgentRegistry(tmp, {});
writeScriptRegistry(tmp, {});

// First run: execute 1 step to populate context
await runCommand(tmp, 'continue', {}, undefined, false, 1);

// Act: Run next 2 more steps
await runCommand(tmp, 'continue', {}, undefined, false, 2);

// Assert: Should have 3 total entries (1 from first run + 2 from second)
const ctx = loadContext(tmp);
expect(ctx.stateHistory.length).toBe(3);
expect(ctx.stateHistory.map((e: any) => e.state)).toEqual(['s1', 's2', 's3']);
```

## Acceptance Criteria

- [ ] `--next=N` flag is parsed correctly from CLI arguments, defaulting to 1 if no value provided
- [ ] When `--next` is present, mode is forced to `'continue'` regardless of `--clean` or `--continue` flags
- [ ] Runner executes exactly N states (or fewer if a terminal state is reached earlier)
- [ ] Each executed state is recorded in `context.json` stateHistory in order
- [ ] Subsequent `raili run --next=M` calls continue from the last state and execute M more steps
- [ ] If no `context.json` exists, `--next` starts from the workflow's initial state
- [ ] States executed via `--next` still respect all normal state behaviors (skip, enter, routing, approval, feedback, teach, exports)
- [ ] If a terminal state is reached before N steps, execution stops and the terminal state's `success` flag is recorded
- [ ] Unit tests cover: parsing `--next`, mode override, step counting, terminal state detection
- [ ] Integration tests validate: single run with limit, multi-run resume with limit, approval/feedback within limit
