# RAI-70 — Part 2: Wire latest output into runners

**Parent ticket:** RAI-70 (RAI-70-improvement-store-latest-output.md)

## Scope
Update runner utilities and state runners to ensure `saveLatestOutput()` is called whenever outputs are stored. Ensure agent, script, and command state runners either call the central `storeOutput()` helper (updated) or directly call `saveLatestOutput()` where appropriate.

## Files to Modify
- src/runner/stateRunnerUtils.ts — call `saveLatestOutput()` alongside `saveOutput()` in `storeOutput()`
- src/runner/agentStateRunner.ts — ensure output storage flow triggers the latest-file logic
- src/runner/scriptStateRunner.ts — same as above for script states
- src/runner/commandStateRunner.ts — same as above for command states

## Implementation Steps
1. Import `saveLatestOutput` from `src/context/outputStore.ts` where needed.
2. In `stateRunnerUtils.storeOutput()`, after calling `saveOutput()`, call `saveLatestOutput()` with the same args.
3. Audit `agentStateRunner.ts`, `scriptStateRunner.ts`, and `commandStateRunner.ts` to confirm they use `storeOutput()`; if any call `saveOutput()` directly, update to call `saveLatestOutput()` as well.
4. Add small unit tests or mocks if the project uses runner-level unit tests to ensure `saveLatestOutput()` gets invoked when `storeOutput()` is used.
5. Run unit tests for runner modules.

## Acceptance Criteria
- [ ] `stateRunnerUtils.storeOutput()` calls both `saveOutput()` and `saveLatestOutput()`
- [ ] Agent/script/command runners trigger `saveLatestOutput()` via `storeOutput()` or direct call
- [ ] Unit tests (runner-level) verify that latest-file writing is invoked when outputs are stored

## Context from Parent
From parent ticket (relevant parts):

> 3. **src/runner/stateRunnerUtils.ts** — Update `storeOutput()` to call `saveLatestOutput()` alongside `saveOutput()`. Both functions accept the same parameters, so add a second call after the `saveOutput()` call.
>
> 15-17. **src/runner/agentStateRunner.ts**, **src/runner/scriptStateRunner.ts**, **src/runner/commandStateRunner.ts** (output storage call)

Note: Part 1 must be completed before this part; pt1 provides the new `saveLatestOutput()` function used here.
