# RAI-36: Route max_visits to desired state

**Type:** improvement

## Description
Change max_visits from a hard stop to a routable exit. Instead of throwing when a state is entered more than the allowed count, allow the workflow author to declare a continuation target. Also change the YAML shape to a structured object to make intent explicit:

```yaml
states:
  state_name:
    max_visits:
      count: 5
      continue: some_state
```

If `continue` is omitted the engine retains the current behavior and will throw when the limit is exceeded. If `continue` is provided and the referenced state does not exist, validation fails (fail-fast).

## Documentation References
- docs/workflow-yaml.md
- src/workflow/schemas.ts

## Code References
- src/types.ts (StateConfig interface)
- src/workflow/schemas.ts (StateConfigSchema)
- src/workflow/schemaValidator.ts (validateStateConfig, validateWorkflowConfig)
- src/workflow/workflowLoader.ts (buildStateMachine)
- src/workflow/workflowLoader.ts (validateStateMachine)
- src/runner/Runner.ts (Runner.enterState, Runner.run, routeToNext, handleSkip)

## Implementation Plan
Ordered steps. Each step names the file, the function/class, and what to do.

1. **src/types.ts** — Change `StateConfig.max_visits` type from `number | undefined` to an optional object:
   ```ts
   max_visits?: { count: number; continue?: string };
   ```
   Update any imported type usages if necessary.

2. **src/workflow/schemas.ts** — Update `StateConfigSchema.max_visits` from `type: 'number'` to `type: 'object'` and update the `description` to document `count` and optional `continue`. (Because schema system uses simple FieldSchema, ensure schemaValidator enforces the object's shape in step 3.)

3. **src/workflow/schemaValidator.ts** — Update `validateStateConfig()` to validate the new `max_visits` object shape:
   - If `config.max_visits` is present, assert it's an object.
   - Ensure it has a numeric `count` property (number > 0).
   - If `continue` is present, ensure it's a string.
   - Keep existing mutual-exclusion and other checks.
   - Throw SchemaValidationError on invalid shapes.

4. **src/workflow/workflowLoader.ts** — Update `buildStateMachine()` to include the `max_visits.continue` state (when present) in the collected `transitions` array for each state so later validation will verify the continuation target exists.

5. **src/runner/Runner.ts** — Modify `enterState()` and surrounding logic:
   - Change `enterState(stateId, stateDef)` to return `Promise<string | null>` where the returned string is a continuation target when the max_visits limit is exceeded and a `continue` target exists.
   - On entry, compute visit count and store in `visitCounts` as before but use `config.max_visits.count`.
   - If visits > count:
     - If `config.max_visits.continue` is defined: record an entry (`this.record(stateId, { max_visits: { exceeded: true, target: '<id>' } })`), present appropriate presenter message (if helpful), and return the continue target string.
     - Else: throw the existing Error(`State '${stateId}' exceeded max_visits limit of ${count}`);
   - Update the main loop in `run()` to handle a non-null value returned from `enterState()` by setting `stateId` to the returned target and continuing the loop (similar to skip logic), without executing the state handler.

6. **src/workflow/schemaValidator.ts (validateStateMachine)** — No code change required if buildStateMachine appended continue target to transitions, but confirm validation behavior. If necessary add explicit check that `max_visits.continue`, if present, refers to an existing state (validateStateMachine will catch because transitions include continue).

7. **docs/workflow-yaml.md** — Update the documentation section for `max_visits` to show the new object form and explain behavior when `continue` is present vs omitted. Add one short example snippet.

8. **Tests** — Add/modify tests as described in the Test Plan below.

## Examples

### Before (old YAML)
```yaml
code:
  type: agent
  agent: coder
  max_visits: 5
  on:
    PASSED: test
    FAILED: code
```

Behavior: On 6th entry the Runner throws before notify/handler.

### After (new YAML)
```yaml
code:
  type: agent
  agent: coder
  max_visits:
    count: 5
    continue: done  # route here on exceeding the limit
  on:
    PASSED: test
    FAILED: code
```

Behavior: On 6th entry the Runner records a max_visits event and routes to state `done` (no handler executed for the exceeded state entry). If `done` is missing, validation fails at load-time.

### Expected console/presenter output (example)
- On first 5 entries: normal presentation of entry + handler.
- On 6th entry: presenter shows "State 'code' exceeded max_visits (5) — routing to 'done'" and `context.json` gets a history entry for the max_visits event.

## Test Plan

### Unit tests (`__tests__/unit/runner.maxvisits.test.ts`)
- **Test case:** "max_visits with continue routes instead of throwing"
  - Setup: Build a StateMachine programmatically with two states: `repeat` (max_visits.count=1, continue: 'done') and `done` (engine terminal).
  - Mock: Minimal Agent/Script runner functions to avoid external side effects (reuse existing runner test mocks pattern). Use a Runner instance constructed with the machine and mock registries/context.
  - Act: Call `await runner.run()` simulating that `repeat` would be entered twice (the runner uses internal visitCounts; ensure initial state is `repeat`).
  - Assert: The final recorded state in context is `done` and no exception was thrown. Assert that a history entry for `repeat` includes meta indicating max_visits exceeded and target 'done'.

- **Test case:** "max_visits without continue throws as before"
  - Setup: State `loop` with max_visits.count=1 and no continue
  - Act: Run runner; on second entry assert that an Error is thrown with message containing "exceeded max_visits".

### Integration test sketch (`__tests__/integration/maxvisits.test.ts`)
- Use established helpers from `__tests__/integration/testUtils.ts`:
  - createTmpWorkspace()
  - writeWorkflow(tmp, yaml) to write a workflow where `code` has max_visits.count:1 and continue: `done`.
  - writeAgentRegistry/tmp scripts if needed.
  - jest.mock('child_process') and use fakeChild to simulate agent/script output.
- Set spawn mock so the agent returns an outcome that routes back to itself to trigger repeated entries.
- Run the engine via the same helper used in other integration tests (e.g. runCommand(...)).
- Assert: loadContext(tmp).stateHistory shows an entry for `code` with meta containing max_visits exceeded and that the final state in history is `done`.

#### Test patterns and mocks
- Follow patterns in `__tests__/integration/testUtils.ts`:
  - Use `fakeChild(stdout, stderr, exitCode)` to simulate copilot/script output.
  - Use `cleanupRailiEnvVars()` in afterEach.
  - Use `loadContext(tmp)` (from src/context/context) to assert final run history.
- Avoid real shell or copilot runs; mock child_process.spawn globally as in other integration tests.

## Acceptance Criteria
- [x] StateConfig type updated: `max_visits` is an object with `count` and optional `continue` (src/types.ts).
- [x] Schema accepts the new `max_visits` object and validates `count` is a positive number and `continue` is a string (src/workflow/schemas.ts + schemaValidator.ts).
- [x] buildStateMachine includes `max_visits.continue` in the state's transitions so validation fails when target missing (src/workflow/workflowLoader.ts).
- [x] Runner no longer throws when a state's visits exceed the configured count if `continue` is provided; instead it routes deterministically to the target (src/runner/Runner.ts). If `continue` is omitted it retains previous throwing behaviour.
- [x] Documentation updated with example and behavior note (docs/workflow-yaml.md).
- [x] Unit and integration tests added per Test Plan demonstrating both behaviors (routing and throwing).


---

*Ticket created by automation. Confirm ID: RAI-36 — improvement — saved as `.issues/1_todo/RAI-36-improvement-route-max-visits-to-desired-state.md`.*
