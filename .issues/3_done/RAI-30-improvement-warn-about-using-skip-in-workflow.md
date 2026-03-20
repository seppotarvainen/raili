# RAI-30: Warn about using skip in workflow

**Type:** improvement

## Description
Some workflows include a `skip` property on states which causes the Engine to bypass those states at runtime. Users sometimes forget to remove `skip` and unintentionally skip important steps. Add a startup warning/prompt that lists all states configured with `skip` and asks the user to confirm (Enter = accept, anything else = decline). If the user declines the run should exit without executing the engine.

This mirrors the existing approval prompt UX (Enter = accept, typed input = reject) used elsewhere in the system to keep behavior consistent.

## Documentation References
- documentation/states.md
- documentation/approval.md
- documentation/usage/run.md

## Code References
- src/run.ts (runCommand) — detect states with `skip`, show prompt, exit if declined
- src/engine/Engine.ts (Engine.run) — current skip routing logic (no behavior change required, but referenced)
- src/workflowLoader.ts (buildStateMachine, validateStateMachine) — `skip` is enumerated into transitions at build/validation time
- src/types.ts (StateConfig) — `skip` property on StateConfig
- src/handlers/manualHandler.ts (handleManualTransition) — reuse existing interactive pattern for Enter=accept behavior

## Acceptance Criteria
- [x] On `raili run` startup, if one or more states have `skip` defined, the CLI prints a clear list: "You have 'skip' enabled in the following states: [stateA, stateB]. Are you sure you want to skip these steps?" and waits for user input.
- [x] Pressing Enter (empty input) proceeds with the run and the Engine behaves unchanged (skipped states are routed over).
- [x] Typing any non-empty input causes the process to exit without executing the Engine (non-zero exit code) and prints a short message explaining the run was cancelled because skips were not confirmed.
- [x] Behavior is testable: unit tests exist under __tests__/unit to validate detection of skip states and run abort on decline by mocking stdin or using the existing RAILI_MANUAL_CHOICE test escape hatch.
- [x] Documentation updated: documentation/states.md (notes about `skip` and the new confirmation prompt) and documentation/usage/run.md (describe the startup prompt and the RAILI_MANUAL_CHOICE test bypass) are updated.
- [x] Implementation reuses existing manual prompt semantics (src/handlers/manualHandler.ts) or isolates a small helper so tests can set RAILI_MANUAL_CHOICE to bypass interactive prompt.


Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>
