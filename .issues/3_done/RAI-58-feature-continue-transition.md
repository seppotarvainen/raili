# RAI-58: Add `continue` transition for states

**Type:** feature

## Description

Introduce a built-in `continue` transition that unconditionally routes to a next state regardless of outcome. This eliminates the need for workarounds like using `on: {PASSED: "next", FAILED: "next"}` or `transitions: {default: "next"}` when the goal is to always proceed to the same state regardless of execution result. The `continue` key will be a top-level routing option on any state, mutually exclusive with `on`, `transitions`, and `approval`.

## Documentation References

- documentation/routing.md
- documentation/states.md

## Code References

- src/types.ts (StateConfig interface)
- src/workflow/schemas.ts (StateConfigSchema)
- src/workflow/stateValidator.ts (validateStateConfig)
- src/runner/runner.ts (routeToNext, main loop)
- src/workflow/workflowLoader.ts (buildStateMachine)
- src/workflow/workflowValidator.ts (state routing validation)

## Implementation Plan

1. **src/types.ts** — Add `continue?: string;` property to `StateConfig` interface (next to `on` and `transitions` properties).

2. **src/workflow/schemas.ts** — Add schema entry for `continue` field to `StateConfigSchema`:
   ```typescript
   continue: {
     required: false,
     type: 'string',
     description: 'Unconditional next state (ignores outcome); mutually exclusive with on, transitions, and approval',
   }
   ```

3. **src/workflow/stateValidator.ts** — Update `validateStateConfig()` to enforce mutual exclusivity:
   - After the existing `on` and `transitions` mutual exclusivity check, add validation that `continue` cannot coexist with `on`, `transitions`, or `approval`.
   - Example error: "State cannot have both 'continue' and 'on' fields"

4. **src/workflow/workflowLoader.ts** — Update `buildStateMachine()` to include `continue` target in the state's transitions array:
   - When processing routing for a state with `continue`, add the continue target to the StateDef.transitions list.
   - This ensures the continue target exists and is reachable (same validation as other routing targets).

5. **src/runner/runner.ts** — Update routing logic in Phase 9 (Route):
   - In `routeToNext()`, check if state has `continue` field before falling back to `on`/`transitions`.
   - If `continue` is set, route directly to that state without evaluating outcome.
   - Pass `continue` as the outcome string for presenter logging (e.g., "appendStateExit(stateDef, 'CONTINUE', nextStateId, elapsedMs)")

6. **src/workflow/workflowValidator.ts** — Update mutual exclusivity validation in `validateStateRouting()`:
   - Ensure a state cannot define more than one of: `on`, `transitions`, `approval`, or `continue`.
   - Add fail-fast error check during workflow load phase.

7. **__tests__/unit/runner.test.ts** — Add unit tests for continue routing:
   - **Test case:** "State with continue routes unconditionally regardless of state result"
     - Setup: Mock state machine with two states (s1 has `continue: "s2"`, s2 is terminal)
     - Act: Create Runner, call run()
     - Assert: Verify s2 is reached and state history shows s1 → s2 transition
   - **Test case:** "Illegal transition: state cannot have both continue and on"
     - Setup: Workflow YAML with state defining both `continue` and `on`
     - Act: Load workflow
     - Assert: Throw SchemaValidationError with clear message
   - **Test case:** "Illegal transition: state cannot have both continue and transitions"
     - Setup: Workflow YAML with state defining both `continue` and `transitions`
     - Act: Load workflow
     - Assert: Throw SchemaValidationError with clear message
   - **Test case:** "Illegal transition: state cannot have both continue and approval"
     - Setup: Workflow YAML with state defining both `continue` and `approval`
     - Act: Load workflow
     - Assert: Throw SchemaValidationError with clear message
   - **Test case:** "Continue target state must exist in state machine"
     - Setup: Workflow YAML with state `continue: "nonexistent"`
     - Act: Load workflow
     - Assert: Throw error during schema validation or state machine build

8. **__tests__/integration/routing.test.ts** (create new or add to existing) — Add integration tests:
   - **Test case:** "Agent with continue routes to next state unconditionally"
     ```typescript
     writeWorkflow(tmp, `
     initial: analyze
     states:
       analyze:
         type: agent
         agent: test_agent
         prompt: "Analyze"
         continue: next_state
       next_state:
         type: engine
     `);
     spawn.mockImplementation((cmd: string) => {
       if (cmd === 'copilot') return fakeChild('failure_key', '', 0);
       return fakeChild('', '', 0);
     });
     await runCommand(tmp, 'clean', {});
     const ctx = loadContext(tmp);
     expect(ctx.stateHistory.map(e => e.state)).toEqual(['analyze', 'next_state']);
     ```
   
   - **Test case:** "Script with continue routes unconditionally on success"
     - Setup: Script state with exit code 0, `continue: "done"`
     - Assert: Routes to done state
   
   - **Test case:** "Script with continue routes unconditionally on failure"
     - Setup: Script state with exit code 1, `continue: "done"`
     - Act: Run workflow
     - Assert: Routes to done state (not to error state)

9. **documentation/routing.md** — Add "Unconditional Routing (continue:)" section after "Terminal State" section:
   ```markdown
   ## Unconditional Routing (continue:)
   
   Routes to a target state unconditionally, regardless of outcome or exit code.
   Useful when side effects matter more than the result (e.g., cleanup, notifications).
   
   ```yaml
   cleanup:
     type: script
     script: cleanup.sh
     continue: done    # routes to 'done' regardless of success/failure
   
   done:
     type: engine
   ```
   
   **Use for:** any state type when result doesn't matter
   
   **Important:** `continue` is mutually exclusive with `on:`, `transitions:`, and `approval:`.
   A state must declare exactly one routing option (or none for terminal states).
   ```

10. **documentation/states.md** — Add note to "Type: engine" section or as a general note:
    - Clarify that terminal states (with no routing) are different from unconditional routing (`continue`).
    - Example: "Use `continue: "next"` if you always want to proceed; use no routing if this is the final state."

## Examples

### Example workflow with continue

```yaml
initial: prepare
states:
  prepare:
    type: command
    command: "echo 'Preparing'"
    continue: execute

  execute:
    type: script
    script: do_work
    continue: cleanup

  cleanup:
    type: command
    command: "echo 'Cleaned up'"
    # No routing — terminal state

```

When executed:
- `prepare` runs and prints "Preparing", routes unconditionally to `execute` (regardless of exit code)
- `execute` runs script (success or failure), routes unconditionally to `cleanup`
- `cleanup` runs and stops (terminal)

**Output in context.json:**
```json
{
  "stateHistory": [
    { "state": "prepare", "enteredAt": "2024-01-01T12:00:00Z" },
    { "state": "execute", "enteredAt": "2024-01-01T12:00:01Z" },
    { "state": "cleanup", "enteredAt": "2024-01-01T12:00:02Z" }
  ]
}
```

### Before vs After (workaround elimination)

**Before (workaround with default):**
```yaml
cleanup:
  type: script
  script: cleanup.sh
  transitions:
    default: done    # always routes to done
```

**After (clean with continue):**
```yaml
cleanup:
  type: script
  script: cleanup.sh
  continue: done     # explicit, more readable
```

## Test Plan

### Unit tests (`__tests__/unit/`)

- **File:** `__tests__/unit/stateValidator.test.ts` (or existing test file)
- **Test case:** "validateStateConfig throws when continue and on both defined"
  - Setup: config = `{ type: 'command', command: 'test', continue: 'next', on: { PASSED: 'other' } }`
  - Act: `validateStateConfig(config, 'state1')`
  - Assert: Throws SchemaValidationError with message containing "both 'continue' and 'on'"

- **File:** `__tests__/unit/stateValidator.test.ts`
- **Test case:** "validateStateConfig throws when continue and transitions both defined"
  - Setup: config = `{ type: 'command', command: 'test', continue: 'next', transitions: { approve: 'other' } }`
  - Act: `validateStateConfig(config, 'state1')`
  - Assert: Throws SchemaValidationError with message containing "both 'continue' and 'transitions'"

- **File:** `__tests__/unit/stateValidator.test.ts`
- **Test case:** "validateStateConfig throws when continue and approval both defined"
  - Setup: config = `{ type: 'engine', continue: 'next', approval: { question: 'OK?', PASSED: 'yes', FAILED: 'no' } }`
  - Act: `validateStateConfig(config, 'state1')`
  - Assert: Throws SchemaValidationError with message containing "both 'continue' and 'approval'"

- **File:** `__tests__/unit/runner.test.ts` (or new file)
- **Test case:** "Runner routes via continue unconditionally"
  - Setup:
    ```typescript
    const stateMachine: StateMachine = {
      initial: 's1',
      states: {
        s1: {
          id: 's1',
          config: { type: 'command', command: 'false', continue: 's2' },
          transitions: ['s2']
        },
        s2: {
          id: 's2',
          config: { type: 'engine' },
          transitions: []
        }
      }
    };
    const runner = new Runner({ stateMachine, context: { stateHistory: [] } });
    ```
  - Act: `await runner.run()`
  - Assert: Final state is 's2', stateHistory contains both 's1' and 's2'

### Integration tests (`__tests__/integration/`)

Follow patterns from `__tests__/integration/testUtils.ts`:

- **Test case:** "Agent with continue unconditionally routes regardless of output"
  - Setup:
    ```typescript
    writeWorkflow(tmp, `
    initial: analyze
    states:
      analyze:
        type: agent
        agent: test_agent
        prompt: "Analyze"
        continue: next_state
      next_state:
        type: engine
    `);
    writeAgentRegistry(tmp, { test_agent: { path: './agents/test.md' } });
    writeAgentFile(tmp, 'agents/test.md', '# Test Agent');
    spawn.mockImplementation((cmd: string) => {
      if (cmd === 'copilot') return fakeChild('any_output', '', 0);
      return fakeChild('', '', 0);
    });
    ```
  - Act: `await runCommand(tmp, 'clean', {})`
  - Assert:
    ```typescript
    const ctx = loadContext(tmp);
    expect(ctx.stateHistory[ctx.stateHistory.length - 1].state).toBe('next_state');
    ```

- **Test case:** "Script with continue routes on both success and failure"
  - Setup: Script state with `continue: "done"`, mock script to exit with code 0, then run again with code 1
  - Act: Run twice (clean and continue) with different exit codes
  - Assert: Both runs route to done state

- **Test case:** "Continue target state must be defined in state machine"
  - Setup: Workflow with state defining `continue: "undefined_state"`
  - Act: `loadWorkflowConfig(tmp)` or `runCommand(tmp, 'clean', {})`
  - Assert: Throws error about missing state (validate during schema validation or state machine build phase)

## Acceptance Criteria

- [ ] `continue` field added to `StateConfig` interface in src/types.ts
- [ ] `continue` schema added to `StateConfigSchema` in src/workflow/schemas.ts
- [ ] Mutual exclusivity validation added to `stateValidator.ts` (fail if `continue` coexists with `on`, `transitions`, or `approval`)
- [ ] `continue` target is included in state machine's transitions array during build (validation that target exists)
- [ ] Runner's routing logic (Phase 9) checks for `continue` and routes unconditionally with correct outcome label ("CONTINUE")
- [ ] Unit tests pass: validation errors for mutual exclusivity, runner test for unconditional routing
- [ ] Integration tests pass: agent with continue, script with continue (both success/failure), invalid continue target
- [ ] documentation/routing.md updated with "Unconditional Routing (continue:)" section with examples
- [ ] documentation/states.md clarified to distinguish between terminal states and `continue` routing
- [ ] No existing tests broken; all test suites pass (`npm test`)
