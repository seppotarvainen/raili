# RAI-63 — Part 2: CLI wiring and listen command

**Parent ticket:** RAI-63 (.issues/1_todo/RAI-63-feature-listen-mode.md)

## Scope
Wire the CLI to recognize `raili listen` and implement the `listenCommand` which performs polling, invokes the trigger module, and starts clean runs with event variables. Depends on Part 1 utilities.

## Files to Modify
- src/cli/railiCommand.ts — add `listen: boolean` property and detection
- src/cli.ts — dispatch to `listenCommand` when `command.listen` is true
- src/cli/listen.ts — NEW file implementing `listenCommand(cwd: string, workflowPath?: string)`
- __tests__/unit/cli/listen.test.ts — unit tests for listenCommand error cases

## Implementation Steps
1. Modify `src/cli/railiCommand.ts`:
   - Add `listen: boolean` to class, set in constructor (`this.listen = this.value === 'listen'`).
2. Update `src/cli.ts`:
   - Detect `command.listen` alongside existing commands and call `await listenCommand(process.cwd(), workflowPath)`.
   - Mirror existing error handling and exit code behavior.
3. Implement `src/cli/listen.ts`:
   - Export `async function listenCommand(cwd: string, workflowPath?: string): Promise<void>`.
   - Fail-fast: check `.raili/` exists and validate registries (reuse patterns from `runCommand`).
   - Use `resolveTriggerPath` to locate trigger; throw if not found.
   - Load trigger via `loadTriggerModule` from Part 1.
   - Poll loop logic:
     - pollIntervalMs = 60000, failureTimeoutMs = 10*60*1000
     - On null event: wait and continue, reset failure timer
     - On object event: call `runCommand(cwd, 'clean', event, workflowPath, false)` and wait before next poll
     - On error: log, start failure timer if needed, exit after timeout
   - Keep loop interruptible by Ctrl+C (no special code required).
4. Unit tests `__tests__/unit/cli/listen.test.ts`:
   - Test throws when trigger missing
   - Test throws when trigger export invalid

## Acceptance Criteria
- [x] CLI parser (`RailiCommand.listen`) recognizes `listen`
- [x] `cli.ts` dispatches to `listenCommand` with same error handling as other commands
- [x] `listenCommand` fails fast on missing `.raili/`, invalid registries, missing trigger
- [x] Polling loop implements behavior described in parent ticket
- [x] Unit tests for error cases are present

## Context from Parent
- From parent ticket (relevant):
  - Steps 25-63 describe changes to `railiCommand`, `cli.ts`, and `src/cli/listen.ts` including polling loop, failure timeout, and invocation of `runCommand` with event variables.
  - Expected call: `await runCommand(cwd, 'clean', event, workflowPath, false)` when trigger returns object.
