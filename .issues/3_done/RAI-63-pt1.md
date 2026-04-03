# RAI-63 — Part 1: Shared trigger infrastructure

**Parent ticket:** RAI-63 (.issues/1_todo/RAI-63-feature-listen-mode.md)

## Scope
Add foundational utilities and types required by the listen feature: resolver for trigger path and a safe trigger-module loader. These are low-level helpers used by the CLI listen command and testable in isolation.

## Files to Modify
- src/context/pathUtils.ts — add `resolveTriggerPath(workflowDir: string): string | null`
- src/handlers/triggerHandler.ts — NEW file: `loadTriggerModule(triggerPath: string): TriggerFunction`
- src/types.ts — add `TriggerFunction` type alias
- __tests__/unit/context/pathUtils.test.ts — unit tests for resolver
- __tests__/unit/handlers/triggerHandler.test.ts — unit tests for module loader

## Implementation Steps
1. Update `src/types.ts` to export:
   - `export type TriggerFunction = () => Promise<Record<string, string> | null>`
2. Modify `src/context/pathUtils.ts`:
   - Export `resolveTriggerPath(workflowDir: string): string | null`.
   - Check for `.raili/<workflow>/trigger.js` using `fs.existsSync` and return absolute path or null.
3. Create `src/handlers/triggerHandler.ts`:
   - Export `export async function loadTriggerModule(triggerPath: string): Promise<TriggerFunction>`.
   - Use `require(path.resolve(triggerPath))` to load module.
   - Validate exported value is a function and is async (or returns a promise when invoked).
   - Throw clear errors on missing file or invalid export.
4. Add unit tests:
   - `__tests__/unit/context/pathUtils.test.ts`: create temp workspace, write `.raili/main/trigger.js`, assert resolver returns absolute path; assert null when missing.
   - `__tests__/unit/handlers/triggerHandler.test.ts`: write trigger.js exporting async function and non-function, assert behavior.

## Acceptance Criteria
- [ ] `TriggerFunction` type exported from `src/types.ts`
- [ ] `resolveTriggerPath` returns absolute path when `.raili/<workflow>/trigger.js` exists and null otherwise
- [ ] `loadTriggerModule` throws when file missing or export invalid
- [ ] Unit tests cover positive and negative cases

## Context from Parent
- From parent ticket (relevant):
  - "Add trigger path resolver: Export `resolveTriggerPath(workflowDir: string): string | null`" (Implementation Plan step 4)
  - "Export async function `loadTriggerModule(triggerPath: string): TriggerFunction`" (Implementation Plan step 5)
  - TriggerFunction interface: `() => Promise<Record<string, string> | null>`


