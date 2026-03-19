# RAI-27: Add ability to skip states

**Type:** feature

## Description
Some workflows need temporary or context-specific bypasses for certain states (e.g., a broken or irrelevant check). Add a "skip" field to state definitions so a state can be immediately routed to another state without executing its runner or side-effects. This makes ad-hoc workflow adjustments safer and faster while keeping the state definition intact for later re-enabling.

Example:
```yaml
my_state:
  skip: my_other_state
  type: command
  command: echo "This state is skipped"
  on:
    PASSED: my_totally_different_state
    FAILED: some_fail_state

my_other_state:
  type: command
  command: echo "This state is not skipped"
```

## Documentation References
- documentation/states.md
- documentation/routing.md
- documentation/approval.md

## Code References
- src/workflowLoader.ts (workflow loading & validation)
- src/engine/Engine.ts (core transition loop, visit counting)
- src/engine/StateRunner.ts (StateRunner base behavior)
- src/engine/AgentStateRunner.ts (AgentStateRunner)
- src/engine/CommandStateRunner.ts (CommandStateRunner)
- src/engine/ScriptStateRunner.ts (ScriptStateRunner)
- src/engine/ApproveStateRunner.ts (ApproveStateRunner)
- src/registryValidator.ts (fail-fast validation of workflow fields)
- src/outputStore.ts (ensure skipped states do not write outputs)
- src/context.ts (context persistence/stateHistory expectations)

## Acceptance Criteria
- [x] The workflow loader accepts an optional `skip: <stateId>` on any state (engine, command, script, agent) and validates that `<stateId>` exists; invalid references cause fail-fast validation errors.
- [x] When a state has `skip` defined, the engine does NOT execute the state's runner, notify hooks, or reset_outputs; it immediately transitions to the `skip` target as if the current state completed with the `skip` outcome.
- [x] Visit counting / `max_visits` is not incremented for skipped states and skipped states do not produce output files in `.raili/outputs/`.
- [x] The engine records the skip action in `.raili/context.json` stateHistory (entry should note it was skipped and the target state).
- [x] Unit tests added/updated under `__tests__/unit/` covering: workflowLoader validation for `skip`, Engine routing for skipped states, and that state runners are not invoked for skipped states (mock runners/handlers).
- [x] An integration test under `__tests__/integration/` validates end-to-end behavior in a temp workspace: a skipped state is bypassed, notify/commands are not run for it, and the workflow continues at the skip target.
- [x] Documentation updated: `documentation/states.md` and `documentation/routing.md` include the `skip` field with examples and explanation.
- [ ] All existing tests pass (`npm test`).


