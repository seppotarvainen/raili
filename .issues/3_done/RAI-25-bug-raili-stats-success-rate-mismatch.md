# RAI-25: raili stats command not showing success rate correclty

**Type:** bug

## Description
The stats command reports the run success rate as "n/a" even when recent run-log entries include an explicit success indicator. The root cause is a field name mismatch: run-log entries are written with `successful: true|false` by appendRunLog (src/runLog.ts) but the stats reader expects `success` (src/cli/stats.ts). This prevents computeMetrics from counting known successes and yields "Success rate: n/a".

Fixing this ensures accurate longitudinal metrics (e.g., 100% success shown when run-log contains successful=true).

## Documentation References
- documentation/output.md

## Code References
- src/runLog.ts (appendRunLog) — currently writes `successful` property
- src/cli/stats.ts (readRunLog, computeMetrics, printMetrics) — expects `success` property; computes successRate
- src/types.ts (StateConfig/StateHistoryEntry) — contextual types for success metadata

## Proposed Resolution
Option A (preferred, single-point change):
- Change appendRunLog in src/runLog.ts to set `success` (boolean) instead of `successful` when writing the JSONL run-log. This aligns the run-log shape with stats.ts and is a backward-compatible semantic (shorter field name).

Option B (defensive, dual compatibility):
- Update readRunLog / computeMetrics in src/cli/stats.ts to treat either `success` or `successful` as the canonical success indicator (prefer `success` when both present). This makes stats tolerant of older run-log lines.

Recommended implementation: apply both changes for robustness — write `success` and update computeMetrics to accept `successful` as a fallback.

## Acceptance Criteria
- [x] `.raili/<workflow>/run-log.jsonl` lines include a top-level boolean `success` field when a terminal entry recorded success (e.g., {"success": true}).
- [x] stats command prints an exact percentage when success values are known (e.g., for a single run with success=true print "Success rate: 100.0%").
- [x] computeMetrics treats only `success` field; legacy `successful` is removed.
- [x] Unit tests added/updated under `__tests__/unit` covering:
  - computeMetrics correctly computes successRate when entries use `success` and when entries use `successful`.
  - readRunLog correctly parses run-log.jsonl with both field names and ignores malformed lines.
- [ ] Integration test under `__tests__/integration` (suggested) that writes a small `.raili/main/run-log.jsonl` containing a single run with `successful: true` and verifies `statsCommand` prints 100% success.
- [x] Documentation updated: documentation/output.md references the `success` field name (or notes both accepted).
- [x] No breaking changes: existing tool behavior unchanged except corrected success reporting.



---

Slug: raili-stats-success-rate-mismatch

