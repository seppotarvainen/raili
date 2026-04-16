# RAI-77 — Part 1: CLI parsing, types and runCommand wiring

**Parent ticket:** RAI-77 (RAI-77-feature-next_steps_flag.md)

## Scope
Add the CLI flag parsing for `--next`, extend shared types, and wire the parsed value through `runCommand()` so the runner can receive a `nextSteps` limit. Include unit tests for CLI parsing.

## Files to Modify
- src/types.ts — add `next?: number` to `RailiRunArgs` and `nextSteps?: number` to `RunnerConfig` (shared types)
- src/cli.ts — parse `--next` (bare `--next` → 1; `--next=N` → number) and force `mode = 'continue'` when present; pass `next` to `runCommand()`
- src/run.ts — extend `runCommand()` signature to accept `nextSteps?: number` and pass through to Runner
- __tests__/unit/cli.test.ts — add tests for parsing `--next` and mode override

## Implementation Steps
1. Update `src/types.ts` to add `next?: number` to `RailiRunArgs` and `nextSteps?: number` to `RunnerConfig`.
2. Modify `src/cli.ts:parseRunArgs()` to accept `--next` and parse it as follows:
   - Bare `--next` (no value) → `next = 1`
   - `--next=N` → parse `N` as integer; validate >0
   - When `next` is defined, set result.mode = 'continue' regardless of other flags
3. Update `src/cli.ts:main()` (or caller) to pass parsed `next` into `runCommand()`.
4. Update `src/run.ts:runCommand()` signature to accept `nextSteps?: number` and include it when constructing Runner config.
5. Add unit tests in `__tests__/unit/cli.test.ts`:
   - parseRunArgs(['--next=3']) → next === 3 and mode === 'continue'
   - parseRunArgs(['--next']) → next === 1 and mode === 'continue'
   - parseRunArgs(['--next=2','--clean']) → mode === 'continue'

## Acceptance Criteria
- [ ] `src/types.ts` includes `next` and `nextSteps` fields
- [ ] CLI accepts `--next` and parses correctly (bare and numeric forms)
- [ ] `--next` forces `mode` to `'continue'`
- [ ] `runCommand()` signature accepts `nextSteps` and forwards it to Runner
- [ ] Unit tests for CLI parsing pass

## Context from Parent
Relevant excerpts:
- "Add a `--next` CLI flag to allow running only the next N steps of a workflow... When `--next` is defined, always use continue mode. If no `context.json` exists, start from the workflow's initial state and run only the specified number of steps." (lines 5-8)
- Implementation Plan (items 1,2,3,4 in the parent ticket) describing types, CLI parsing, and runCommand wiring.
- Acceptance Criteria items 1-3 in the parent ticket related to parsing and forcing continue mode.