# RAI-70 — Part 1: Add saveLatestOutput and unit tests

**Parent ticket:** RAI-70 (RAI-70-improvement-store-latest-output.md)

## Scope
Add a new helper `saveLatestOutput()` to `src/context/outputStore.ts` and update `saveOutput()` to call it. Provide unit tests ensuring correct path, filtering, overwrite behavior, and early returns when not storing or when filtered output is empty.

## Files to Modify
- src/context/outputStore.ts — add `saveLatestOutput()`; update `saveOutput()` to call it
- __tests__/unit/outputStore.test.ts — add unit tests for `saveLatestOutput()` and update related assertions

## Implementation Steps
1. Add `saveLatestOutput(cwd, stateId, output, outputConfig, workflowArg)` to `src/context/outputStore.ts`.
2. Implement identical filtering logic (marker extraction, tail) as used by `saveOutput()`.
3. If `outputConfig.store` is false or filtered output is empty, return early.
4. Write filtered output to `<stateId>.latest.md` using overwrite mode (use `writeFileSync`), not append.
5. Update `saveOutput()` to call `saveLatestOutput()` after successful append.
6. Add unit tests in `__tests__/unit/outputStore.test.ts`:
   - verify `.latest.md` path and content
   - verify marker and tail filtering
   - verify early returns
   - verify overwrite behavior

## Acceptance Criteria
- [ ] `saveLatestOutput()` exists and follows the same filtering rules as `saveOutput()`
- [ ] `saveOutput()` calls `saveLatestOutput()` after appending history
- [ ] Unit tests cover path, filtering, early returns, and overwrite

## Context from Parent
From parent ticket (relevant parts):

> 1. **src/context/outputStore.ts** — Add `saveLatestOutput()` function to write the filtered output to `<stateId>.latest.md` (overwrite mode, not append). This function should:
>    - Accept the same parameters as `saveOutput` (cwd, stateId, output, outputConfig, workflowArg)
>    - Apply the same filtering (marker extraction, tail) as the main output
>    - Write (not append) to `<stateId>.latest.md`
>    - Return early if outputConfig.store is false or filtered output is empty
>
> 2. **src/context/outputStore.ts** — Update `saveOutput()` to call `saveLatestOutput()` after successfully saving the timestamped output. Add the call at the end of the function after the existing append logic completes.
