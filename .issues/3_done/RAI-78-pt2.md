# RAI-78 — Part 2: Context rollback implementation

**Parent ticket:** RAI-78 (RAI-78-feature-rollback-capability.md)

## Scope
Implement `rollbackHistory(context, rollbackArg)` in `src/context/context.ts`. This utility will truncate `context.stateHistory` either by numeric count (remove last N entries) or by state ID (keep up to the last occurrence of that state). It must validate inputs and throw descriptive errors on invalid requests. Preserve other context fields (vars, approvals, feedbacks).

## Files to Modify
- src/context/context.ts — add `rollbackHistory(context: WorkflowContext, rollbackArg: string): WorkflowContext`
- __tests__/unit/context.test.ts — add unit tests covering numeric rollback, state-id rollback, and error cases

## Implementation Steps
1. Add exported function `rollbackHistory(context, rollbackArg)` to `src/context/context.ts`.
2. Implement parsing: if `rollbackArg` is numeric (all digits) treat as count N; else treat as state ID.
3. For numeric N: if N > stateHistory.length throw `Cannot rollback ${N} steps: history only has ${M} entries`; else return new context with last N entries removed.
4. For state ID: find last index of entry with that state; if not found throw `State '${id}' not found in history`; else truncate history to that index (inclusive).
5. Ensure function returns a new context object (no in-place mutation) and preserves `vars`, `approvals`, `feedbacks`.
6. Add unit tests in `__tests__/unit/context.test.ts` matching test cases from parent ticket (remove N entries, rollback to state, invalid count, missing state, preserve vars).

## Acceptance Criteria
- [ ] `rollbackHistory()` implemented and exported from `src/context/context.ts`
- [ ] Numeric rollback removes last N entries and errors when N > history length
- [ ] State-ID rollback truncates to last occurrence of the state and errors if not found
- [ ] Function returns new context reference, preserves other fields
- [ ] Unit tests cover all cases and pass

## Context from Parent
Relevant sections:
- "Add new function `rollbackHistory(context: WorkflowContext, rollbackArg: string): WorkflowContext`"
- "For numeric count: removes the last N entries from `stateHistory`"
- "For state ID: finds the last occurrence of that state in history and removes all entries after it (keeping that state's entry)"
- Error messages examples: `"Cannot rollback N steps: history only has M entries"`, `"State 'code' not found in history"`
- "Preserve `context.vars`, `context.approvals`, `context.feedbacks` (no changes to exposed vars)"