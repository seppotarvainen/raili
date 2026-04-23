# RAI-78 — Part 1: CLI parsing & types

**Parent ticket:** RAI-78 (RAI-78-feature-rollback-capability.md)

## Scope
Add a `rollback` field to the CLI types and implement parsing of `--rollback=` in parseRunArgs(). Ensure the flag is normalized to a string, and that providing `--rollback` forces `continue` mode. Pass the parsed value through to `runCommand()` when the CLI invokes it.

## Files to Modify
- src/types.ts — add `rollback?: string` to `RailiRunArgs`
- src/cli.ts — parse `--rollback` in `parseRunArgs()` and ensure CLI run invocation passes it to `runCommand()`
- __tests__/unit/cli.test.ts — add unit tests for parsing and forced continue mode

## Implementation Steps
1. Update `RailiRunArgs` in `src/types.ts` with an optional `rollback?: string` field.
2. In `src/cli.ts` `parseRunArgs()` support `--rollback=N` and `--rollback=STATE_ID`; normalize to string (e.g., `'1'` or `'analyze'`).
3. Ensure when `rollback` is present `mode` is set to `'continue'` in the returned args object.
4. Update the CLI command invocation site to pass `args.rollback` into `runCommand()` (keep backward compat).
5. Add unit tests in `__tests__/unit/cli.test.ts` for the three parse cases (`numeric`, `state id`, and forcing continue).

## Acceptance Criteria
- [ ] `src/types.ts` includes `rollback?: string` in `RailiRunArgs`
- [ ] `parseRunArgs()` parses `--rollback=3` and `--rollback=analyze` returning `rollback: '3'|'analyze'`
- [ ] `parseRunArgs()` forces `mode: 'continue'` when `--rollback` present
- [ ] CLI run invocation passes `rollback` to `runCommand()` without breaking existing behavior
- [ ] Unit tests for CLI parsing added and passing

## Context from Parent
From the parent ticket:
- "Add optional `rollback?: string | number` field to `RailiRunArgs` interface"
- "Parse `--rollback` flag in `parseRunArgs()` function. Support formats: `--rollback=1`, `--rollback=3`, `--rollback=code`. Normalize and return as string in `RailiRunArgs.rollback`"
- "`--rollback` flag forces 'continue' mode (as if `--continue` was supplied)"