# RAI-70 — Part 3: Integration tests and verification

**Parent ticket:** RAI-70 (RAI-70-improvement-store-latest-output.md)

## Scope
Add integration tests that exercise agent/script states with `output.store: true` to verify both the timestamped history file and the `.latest.md` file are created and updated correctly, and that filtering (marker, tail) is identical for both files.

## Files to Modify / Create
- __tests__/integration/outputStore.test.ts — new integration test covering first run, second run, and marker behavior

## Implementation Steps
1. Create `__tests__/integration/outputStore.test.ts` using test utilities (`createTmpWorkspace`, `writeWorkflow`, `writeAgentRegistry`, `writeAgentFile`, `fakeChild`, etc.).
2. Test case A: First run creates both `<stateId>.md` and `<stateId>.latest.md` with identical filtered content.
3. Test case B: Second run appends to history file and overwrites `.latest.md` with only the new run.
4. Test case C: Marker extraction and tail filtering produce identical content in both files.
5. Run integration tests (they use mocked `spawn`) and verify assertions.

## Acceptance Criteria
- [x] Integration test file exists and runs in CI locally (using repo's test harness)
- [x] Tests assert first-run creation of both files
- [x] Tests assert second-run overwrite behavior for `.latest.md` and append for history
- [x] Tests assert identical filtering behavior

## Context from Parent
From parent ticket (relevant parts):

> 4. **__tests__/integration/outputStore.test.ts** — Add integration test case(s) to verify:
>    - First run creates both `<stateId>.md` and `<stateId>.latest.md`
>    - Second run appends to `<stateId>.md` but overwrites `<stateId>.latest.md`
>    - Filtering (marker, tail) is applied identically to both files
>    - Empty outputs are not written

> Example sketches and test case outlines are provided in the parent ticket and should be followed closely to match project test patterns.
