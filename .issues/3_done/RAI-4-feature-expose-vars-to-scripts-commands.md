# RAI-4: Expose environment variables from scripts and commands

**Type:** feature

## Description
Allow script and command states to explicitly expose variables from their execution into the workflow environment so subsequent states can consume them via environment variables (RAILI_VAR_<UPPERCASE>). This enables workflows to return values (IDs, paths, flags) from shell scripts/commands and make them available to later `command` or `script` states. If a state declares `expose: [ ... ]`, the engine must verify those variables are set after the state completes and throw an error if any are missing.

## Documentation References
- documentation/variables.md
- documentation/states.md

## Code References
- src/handlers/scriptHandler.ts (executeScript)
- src/handlers/commandHandler.ts (executeCommand)
- src/engine/ScriptStateRunner.ts (Script state runner)
- src/engine/CommandStateRunner.ts (Command state runner)
- src/engine/Engine.ts (state loop, validation, routing)
- src/variableInterpolation.ts (variable interpolation/export rules)
- src/workflowLoader.ts (parsing `expose` field from workflow)
- src/registryValidator.ts (validation of workflow fields)
- src/outputStore.ts (optional: capturing stdout for exposed vars)

## Acceptance Criteria
- [x] Workflow YAML may include `expose: [name1, name2]` on `script` and `command` states and these are parsed without schema errors.
- [x] After the state completes, any names listed under `expose` are exported into the environment for subsequent states as `RAILI_VAR_<UPPERCASE>` (e.g. `id` → `RAILI_VAR_ID`).
- [x] The engine validates that each exposed variable is present (non-empty) immediately after the state finishes; if any are missing, the engine throws an explicit error and halts execution (fail-fast).
- [x] The feature applies only to `script` and `command` state types; attempts to declare `expose` on `agent` or `engine` states produce a validation error at workflow load time.
- [x] Unit tests added under __tests__/unit covering: parsing `expose`, successful export of variables, missing-variable error path, and invalid use of `expose` on unsupported state types. All external side effects (child_process spawn, fs) must be mocked.
- [x] Documentation updated: documentation/variables.md and documentation/states.md include a short example and behavior notes for `expose`.
- [ ] Integration-style test (suggested) under __tests__/integration that runs a minimal workflow with a `script` state writing `id=123` to stdout or to a file and exposing `id`, followed by a `command` state that echoes `$RAILI_VAR_ID`, asserting the value is available.

## Notes / Implementation Guidance
- Recommended approach: after a `script`/`command` completes, parse state stdout and/or structured output (e.g., key=value lines) to populate the named exposed variables. Define and document the accepted extraction format (simple heuristics: search for `^name=(.*)$` in stdout or require the script to write a small JSON to a well-known path when `output.store` is enabled). Keep engine deterministic: extraction rules must be explicit and testable.
- Enforcement: Add workflow schema changes or loader checks in `workflowLoader.ts` / `schemaValidator.ts` to disallow `expose` on unsupported state types.
- Tests: Mock child_process and file IO. Unit tests should assert that missing exposes cause engine to throw before routing to next state.


