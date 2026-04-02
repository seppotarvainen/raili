# RAI-59 — Part 2: Implement readLatestNRuns in outputStore

**Parent ticket:** RAI-59 (RAI-59-improvement-multiple-stored-outputs.md)

## Scope
Implement new output store utility `readLatestNRuns(cwd, stateId, n?, workflow?)` to read and concatenate the latest N stored runs. Provide unit tests that validate edge cases and expected concatenation/separators. This part depends on types/schema in pt1.

## Files to Modify
- src/context/outputStore.ts — add `readLatestNRuns` and related helpers
- __tests__/unit/context/outputStore.multipleRuns.test.ts — new unit tests for the function

## Implementation Steps
1. Add `readLatestNRuns(cwd: string, stateId: string, n?: number | null, workflowArg?: string)` to `src/context/outputStore.ts`:
   - If file missing: return null
   - If n is undefined or null: return all runs concatenated
   - If n <= 0: return empty string
   - If n provided: extract the latest N runs (chronological order oldest→newest) and preserve run separators (`--- Run ...`)
2. Reuse existing parsing logic for run separators if present. Keep API compatible with existing readLatestRun callers.
3. Add unit tests under `__tests__/unit/context/outputStore.multipleRuns.test.ts` covering the cases from the parent ticket (nonexistent file, undefined/null n, n=0/negative, n > available).
4. Mock filesystem where tests require and follow repository testing patterns.

## Acceptance Criteria
- [ ] `readLatestNRuns` implemented with documented behavior
- [ ] Unit tests for all specified cases added and deterministic

## Context from Parent
From parent ticket:
"Add new function `readLatestNRuns(cwd, stateId, n, workflowArg?)` — concatenate latest N runs (oldest first); if omitted, return all runs; if n <=0 return empty (or null); preserve run separators; return null if no file exists."