# RAI-24: Store run-log durations in milliseconds

**Type:** bug

## Description
Run logs currently store `duration` as human-readable strings (e.g. "1m30s", "33s"). This prevents reliable aggregation and statistical calculations. Store durations as integer milliseconds in the run-log JSONL files and convert to human-readable format only when displaying results.

## Documentation References
- documentation/output.md
- documentation/usage

## Code References
- .raili/main/run-log.jsonl (run-log entries)
- .raili/test/run-log.jsonl (run-log entries)
- src/cli.ts (run completion hook / where runs are finalized)
- src/context.ts (context persistence)
- src/outputStore.ts (output/run-log handling)
- src/engine/Engine.ts (run termination logic)

## Acceptance Criteria
- [x] Run-log records store `duration` as an integer number of milliseconds (e.g. `"duration": 90000`) in `.raili/*/run-log.jsonl`.
- [ ] Existing run-log examples in `.raili/main/run-log.jsonl` and `.raili/test/run-log.jsonl` are updated to use milliseconds.
- [x] CLI `stats` or any aggregation command reads durations as integers and computes totals/averages correctly.
- [x] Display formatting still supports converting milliseconds to human-readable form for UI/CLI output.
- [ ] Unit tests added/updated under `__tests__/unit` to verify serialization format and aggregation logic.
- [ ] (Optional) Integration test under `__tests__/integration` verifies end-to-end run logging and `stats` command behavior.

Notes:
- Updated src/runLog.ts to store numeric `duration` (ms) and added `durationHuman` for display.

---

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>