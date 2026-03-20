# RAI-31: Wait time should not be included in duration (run-log.jsonl)

**Type:** improvement

## Description
Some states intentionally pause execution for human interaction (approval, feedback) or other idle waits. The current run-log duration computed in `.raili/<workflow>/run-log.jsonl` uses only the state's `enteredAt` timestamps and therefore includes idle wait time, which skews metrics and obscures real processing bottlenecks. Adjust the run-log computation and/or context metadata so `duration` reflects only active processing time (exclude manual approval/feedback waits and any explicit idle periods).

## Documentation References
- documentation/approval.md
- documentation/states.md
- documentation/output.md

## Code References
- src/runLog.ts (appendRunLog) — compute run duration; currently uses enteredAt timestamps
- src/context.ts (addStateToHistory, saveContext, loadContext) — state history shape and persistence
- src/engine/Engine.ts (Engine.run) — state entry, approval/feedback orchestration, where waits occur and history meta is appended
- src/engine/ApproveStateRunner.ts (runApprovalStep) — approval notify + manual prompt timing
- src/handlers/manualHandler.ts (handleManualTransition, handleFeedbackPrompt) — blocking stdin reads that constitute idle wait
- src/engine/AgentStateRunner.ts (runAgentState) — agent execution wrapper (may be marked active)
- src/engine/ScriptStateRunner.ts (runScriptState) — script execution wrapper
- src/engine/CommandStateRunner.ts (runCommandState) — command execution wrapper
- src/outputStore.ts (saveOutput) — may be referenced when storing outputs that are unrelated but useful for testing

## Suggested Implementation Notes
- Preferred approach: record explicit timestamps for active processing periods and waiting periods, then compute run duration by summing only active periods. Options:
  - Add `exitedAt` to each state history entry and record `meta.waitPeriods: Array<{start: ISO, end: ISO}>` for approvals/feedback where waiting occurs; appendRunLog would sum (exitedAt - enteredAt) minus sum(waitPeriods).
  - Simpler: When entering a manual prompt (handleManualTransition or handleFeedbackPrompt), record a `meta.waitStartedAt` on the current state's history entry; when the prompt completes, merge a `meta.waitEndedAt` and accumulate wait duration into `meta.waitMs`. appendRunLog subtracts aggregated `meta.waitMs` from the run duration.
  - Ensure backward compatibility: if `meta.waitMs` or new fields are missing, fall back to previous behavior (duration = terminalEnteredAt - runStart) to avoid crashes.
- Changes will touch context mutation logic in Engine.run and in manualHandler functions where prompts happen so wait intervals are captured deterministically.
- Keep the core deterministic: all new metadata must be written to `.raili/context.json` so runs are auditable and resumable.

## Acceptance Criteria
- [x] run-log.jsonl `duration` equals total active processing time (total run time minus idle wait time from approvals/feedback) for runs that include approvals and feedback.
- [x] New metadata fields (e.g., `meta.waitMs`, or `meta.waitPeriods`) are persisted into `.raili/context.json` for states that incurred wait time.
- [x] Backward compatibility: if new metadata is absent, `appendRunLog` falls back to previous duration calculation without throwing.
- [x] Unit tests added/updated under `__tests__/unit/` covering:
  - `appendRunLog` behavior when `context.stateHistory` contains wait metadata (verify subtraction of wait time)
  - `addStateToHistory` or context merging behavior when wait metadata is written
- [x] Integration test added under `__tests__/integration/` that simulates a workflow run containing at least one approval and verifies the run-log line's `duration` excludes the simulated wait interval (use mocked time or fake child/process hooks to simulate delays and ensure determinism).
- [x] Documentation updated where relevant (documentation/approval.md or documentation/states.md) to note that run-log duration excludes manual wait time and describe the new context metadata fields.
- [x] Code reviewed and validated: all changes compile and existing tests continue to pass.

## Testing Recommendations
- Unit tests should mock `loadContext` and provide synthetic `stateHistory` entries with `meta.waitMs` or `meta.waitPeriods` to assert `appendRunLog` returns correct `duration`.
- Integration test should use existing integration helpers to create a temporary workspace, write a workflow that includes an approval state, set `RAILI_MANUAL_CHOICE` in environment to simulate approval timing, and assert the run-log entry duration is less than wall-clock time by at least the simulated wait.


