# RAI-73 — Part 2: Inject `workflow` into context initialization

**Parent ticket:** RAI-73 (RAI-73-improvement-add-default-workflow-variable.md)

## Scope
Modify context initialization to inject a `workflow` variable (the current workflow name) into `context.vars` so it is available during interpolation and persisted to `.raili/<workflow>/context.json`.

## Files to Modify
- src/run.ts — determine workflow dir/name and inject into context.vars before creating Runner
- src/context/context.ts — ensure initializeContext accepts/merges provided vars and persists `workflow`
- __tests__/unit/run.test.ts — unit tests for clean and continue modes

## Implementation Steps
1. Use `getWorkflowName(cwd, workflowArg)` (from pt1) to compute name.
2. In `src/run.ts` (runCommand), after resolving workflowDir (or defaulting), inject `context.vars.workflow = workflowName` before Runner creation.
3. Ensure both clean and continue runs set or preserve the `workflow` var: for continue, prefer existing value in loaded context but validate it matches resolved workflow (or keep existing per ticket plan).
4. Update or add unit tests in `__tests__/unit/run.test.ts` to assert `context.vars.workflow` is set to `main` (default) and to `dev` for named workflow; and that continue preserves existing value.
5. Run unit tests locally (CI will verify repository-wide).

## Acceptance Criteria
- [x] `run.ts` injects `workflow` into `context.vars` for clean runs
- [x] Continue runs preserve existing `workflow` in context.json
- [x] Unit tests added/updated and passing locally

## Context from Parent
Relevant excerpts from parent ticket:
- "Modify `runCommand()` to determine the workflow name and inject it into context.vars before creating the Runner"
- "Ensure this is done for both clean and continue runs"
- Code references: `src/run.ts`, `src/context/context.ts`, `src/context/pathUtils.ts`.