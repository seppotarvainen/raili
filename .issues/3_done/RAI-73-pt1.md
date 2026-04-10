# RAI-73 — Part 1: Workflow name helper

**Parent ticket:** RAI-73 (RAI-73-improvement-add-default-workflow-variable.md)

## Scope
Add a reusable helper to determine the canonical workflow name from the CLI/workflow argument and working directory. This centralizes name resolution for subsequent changes.

## Files to Modify
- src/context/pathUtils.ts — add `getWorkflowName(cwd: string, workflowArg?: string): string`
- __tests__/unit/pathUtils.test.ts — unit tests for the helper

## Implementation Steps
1. Add exported function `getWorkflowName(cwd, workflowArg?)` to `src/context/pathUtils.ts`.
2. Reuse existing `resolveWorkflowDir()` logic if available; otherwise implement minimal resolution: if `workflowArg` provided, return `path.basename(resolveWorkflowDir(cwd, workflowArg))`, else return `path.basename(resolveWorkflowDir(cwd, 'main'))`.
3. Add unit tests in `__tests__/unit/pathUtils.test.ts` that mock workspace layouts and assert correct names for default and named workflows.
4. Ensure function throws or returns a deterministic string for edge cases (trim slashes, no `.` or empty).

## Acceptance Criteria
- [ ] `getWorkflowName()` implemented in `src/context/pathUtils.ts`
- [ ] Unit tests assert `main` when no workflowArg and correct name when provided
- [ ] No behavior changes elsewhere

## Context from Parent
Relevant excerpts from parent ticket:
- "Create `getWorkflowName(cwd: string, workflowArg?: string): string`"
- "Returns the canonical workflow directory name without path separators (e.g., \"main\", \"dev\")"
- Implementation plan references `src/context/pathUtils.ts` and `src/run.ts` for later injection.