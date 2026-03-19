# RAI-22: Add new CLI command for checking trends

**Type:** feature

## Description
Add a new top-level CLI command `raili stats [<workflow>]` that summarizes recent workflow runs (default workflow: `main`). The command shows trends (average loops/run, approval fail rate, success rate, avg states/run) across the last N runs (configurable via `--latest`).

Put the code in its own statsCommand and don't pollute cli.ts.

## Documentation References
- documentation/usage
- documentation/stats.md (new, explain what trends & stats user can get insights from)

## Code References
- src/cli.ts (main command dispatcher)
- src/help.ts (add ref to stats here)
- src/runLog.ts (currently stores run statistics for calculation, file that is produced here is essential (.raili/<workflow>/run-log.jsonl) for stats calculation. This file doesn't need modification.)
- src/cli/stats.ts (new command module to implement)
- __tests__/unit/cli.stats.test.ts (unit tests for stats computation)
- __tests__/integration/stats.integration.test.ts (integration test exercising raili stats against a temp .raili workspace)

## Acceptance Criteria
- [x] `raili stats` runs without errors and defaults to workflow `main` when no positional workflow is provided.  
- [x] `raili stats <workflow>` reads the specified workflow's `.raili/<workflow>/run-log.jsonl` and computes metrics across the last N runs.  
- [ ] Output matches the example format (shows previous vs current values and directional arrow with a short descriptor like “improving” or “regressing”).
- [ ] `--latest <n>` flag limits the window to the last `n` runs and is validated (positive integer).
- [ ] Unit tests under `__tests__/unit` cover the metrics computation logic with edge cases (no runs, single run, division by zero) and pass.
- [ ] An integration test under `__tests__/integration` validates end-to-end behavior using a sandboxed workspace and mocked external side effects, asserting printed output and that no real external processes are spawned.
- [ ] `src/cli.ts` help and docs are updated to include the new `stats` command and its flags.
- [ ] Documentation (documentation/usage) includes short usage example and explanation for the `stats` command. Also add `stats.md` file for more throughout description.


Implementation notes:
- Added src/cli/stats.ts containing readRunLog, computeMetrics and statsCommand.
- Added unit tests for computeMetrics in __tests__/unit/cli.stats.test.ts.
