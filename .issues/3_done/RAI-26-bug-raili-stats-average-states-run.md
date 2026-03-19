# RAI-26: 'raili stats' command not showing 'Average states/run' correclty

**Type:** bug

## Description
The `stats` command reports `Average states/run` as 0.00 even though `.raili/<workflow>/run-log.jsonl` contains non-zero per-run state counts. Root cause: `src/runLog.ts::appendRunLog` writes a numeric `states` field, but `src/cli/stats.ts::computeMetrics` only reads `stateCount` or `statesVisited`. This mismatch causes avgStates to always be computed as 0.

Fixing this will make metrics accurate and actionable for pipeline analysis.

## Documentation References
- documentation/output.md
- documentation/usage/run.md

## Code References
- src/runLog.ts (appendRunLog)
- src/cli/stats.ts (RunEntry type, computeMetrics, readRunLog, statsCommand, printMetrics)
- src/run.ts (runCommand — calls appendRunLog)
- .raili/<workflow>/run-log.jsonl (example log file format)

## Acceptance Criteria
- [ ] computeMetrics reads the actual run-log field written by appendRunLog (accept `states`, `stateCount`, or `statesVisited`) so `avgStates` is computed correctly.
- [ ] Unit tests added/updated under `__tests__/unit/` covering: parsing of `states` from run-log lines, computeMetrics aggregation, and stats printing for single and multiple runs.
- [ ] Integration test suggested/added under `__tests__/integration/` that writes a temp `.raili/<workflow>/run-log.jsonl` with varying `states` values and asserts `statsCommand` outputs a non-zero `Average states/run`.
- [ ] Documentation updated (if needed) to describe the run-log schema and that `states` is the canonical per-run state count.
- [ ] All tests pass (`npm test`).


---

Notes / Rationale:
- The change is low-risk and backwards compatibility is not required per task notes. Broad compatibility can be achieved by accepting all three common field names in computeMetrics.
- Preferred fix: update `computeMetrics`/`RunEntry` parsing to accept `states` in addition to `stateCount`/`statesVisited` (minimal surface change).

