# RAI-3: Accept variables for script type

**Type:** improvement

## Description
Add support for passing an ordered list of arguments/variables to `script` states. The engine should allow a state-configured `args` array which the runtime forwards to the script process; the script itself is responsible for interpreting the values. This enables workflows to pass runtime parameters to registered scripts without changing their registry entries.

## Documentation References
- documentation/states.md
- documentation/variables.md

## Code References
- src/types.ts (StateConfig: add `args?: string[]`)
- src/engine/ScriptStateRunner.ts (runScriptState)
- src/handlers/scriptHandler.ts (executeScript)
- src/workflowLoader.ts (buildStateMachine, validateStateMachine)
- __tests__/engine/ScriptStateRunner.test.ts (new unit tests)
- __tests__/handlers/scriptHandler.test.ts (new unit tests)

## Acceptance Criteria
- [x] State schema/types updated: `StateConfig` includes optional `args?: string[]` for `script` states.
- [x] Workflow loader/validator accepts `args` on `script` states and still enforces required `script` property.
- [x] Script handler signature updated to accept an args array and pass them to the spawned process (spawn(fullPath, args, ...)).
- [x] ScriptStateRunner forwards `state.config.args` to the handler and preserves existing routing behavior (`on` / `transitions`).
- [x] Unit tests added that mock script execution and verify: (a) args are passed to the handler, (b) `on` and `transitions` routing remain unchanged, (c) output storing still works.
- [x] Documentation updated (documentation/states.md and documentation/variables.md) with example YAML and explanation:
  ```yaml
  my_script_state:
    type: script
    script: run_tests
    args:
      - 'This is the first argument'
      - '--verbose'
  ```
- [ ] `npm test` passes locally (tests mock external execution; no real scripts run).


