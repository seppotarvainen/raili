# RAI-73 — Part 3: Export and interpolation support for `workflow` variable

**Parent ticket:** RAI-73 (RAI-73-improvement-add-default-workflow-variable.md)

## Scope
Ensure the injected `workflow` variable is available to interpolation utilities and exported to process env (as `RAILI_VAR_WORKFLOW`) for shell commands, notifications, and agent handlers.

## Files to Modify
- src/variables/variableInterpolation.ts — ensure interpolation sees `workflow` in provided vars and behaves consistently
- src/runner/stateRunnerUtils.ts (or the module that assembles env for child processes) — add mapping to export `RAILI_VAR_WORKFLOW`
- __tests__/unit/variableInterpolation.test.ts — unit test for interpolation with `workflow`
- __tests__/unit/stateRunnerUtils.test.ts — unit test ensuring env contains `RAILI_VAR_WORKFLOW`

## Implementation Steps
1. Verify interpolation code reads from context.vars; add tests that call interpolateString/interpolateObject with a vars object that includes `workflow` and assert correct substitution.
2. Locate code that sets up env for spawned processes (commands, notifications, scripts). Add an explicit mapping so every `context.vars` key is exported as `RAILI_VAR_<UPPERCASE>` including `workflow`.
3. Add unit tests that simulate spawning a command and assert that `opts.env['RAILI_VAR_WORKFLOW']` is set to expected value.
4. Ensure no regressions for other variables; keep behavior consistent with existing variable export rules.

## Acceptance Criteria
- [x] `workflow` is usable by interpolation utilities
- [x] `RAILI_VAR_WORKFLOW` is present in child process env for commands/notifications
- [x] Unit tests added and passing locally

## Context from Parent
Relevant excerpts from parent ticket:
- "`workflow` variable is exported as `$RAILI_VAR_WORKFLOW` in the process environment for shell commands and notifications"
- "`workflow` variable is available for interpolation in YAML (agent prompts, commands, approval questions)"
- Code references: `src/variables/variableInterpolation.ts`, `src/runner/runner.ts` (runner has workflowArg), and `src/context/pathUtils.ts`.