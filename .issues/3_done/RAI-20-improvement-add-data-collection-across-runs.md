# RAI-20: Add data collection across runs

**Type:** improvement

## Description
Currently a clean run wipes `.raili/<workflow>/context.json` making it impossible to measure trends across runs. Add an append-only run log `.raili/<workflow>/run-log.jsonl` and write a one-line JSON summary after each run reaches a terminal state. This enables longitudinal metrics (rework, approval failures, durations) without changing the resumable context behavior.

## Documentation References
- documentation/states.md
- documentation/approval.md
- documentation/output.md
- documentation/usage/run.md

## Code References
- src/run.ts (orchestrates CLI run life-cycle)
- src/context.ts (context persistence and clean-run behavior)
- src/engine/Engine.ts (engine loop, terminal-state detection)
- src/engine/ApproveStateRunner.ts (approval outcome counting)
- src/outputStore.ts (existing output handling; ensure atomic writes)
- src/workflowLoader.ts (resolve active workflow id/name)
- src/variableInterpolation.ts (declared inputs handling)
- src/learningStore.ts (existing telemetry-like store; optional integration)
- __tests__/unit/run-log.test.ts (new unit tests)
- __tests__/integration/run-log.integration.test.ts (new integration test)

## Acceptance Criteria
- [x] After a workflow run reaches a terminal state, a file `.raili/<workflow>/run-log.jsonl` exists and a single JSON line is appended describing the run.
- [x] Each appended JSON line contains at minimum: `runId` (ISO8601 start timestamp), `vars` (only inputs declared in the workflow), `states` (total number of state entries visited during the run), `loops` (sum of revisits: for each state max(0, visits-1)), `approvalFailures` (count of approval states that produced `FAILED`), `terminalState` (final state id), `successful` (present only if engine can determine terminal success), and `duration` (human-readable runtime, e.g. "4m32s").
- [x] Implementation appends atomically (no truncation of existing file) and tolerates concurrent reads.
- [x] Unit tests in `__tests__/unit` mock filesystem and timers to assert correct JSON fields and calculations (loops, approvalFailures, vars filtering). Tests must not spawn real processes.
- [x] Integration test in `__tests__/integration` exercises a small workflow that exercises loops and an approval failure, runs the engine in a temp workspace, and asserts a valid JSONL line was appended with correct counts.
- [x] Documentation updated: add a short note to `documentation/usage/run.md` and `documentation/output.md` describing the run-log location and format.
- [x] Existing behavior unchanged for resume and context persistence: `.raili/<workflow>/context.json` is still used for resume and is not repurposed for trend storage.

## Implementation notes
- Define `loops` as the total number of revisits across states: sum over states of (visits - 1) when visits > 1. This is a clear, testable proxy for rework.
- Only include workflow-declared inputs in `vars`. Read declared inputs from the workflow metadata (via `workflowLoader.ts`) and pull actual values from `.raili/<workflow>/context.json` state variables.
- Compute `approvalFailures` by counting `FAILED` entries for approval states in the persisted state history in context.
- Append JSONL lines using an atomic append (fs.appendFile or equivalent) and ensure newline-separated JSON objects.
- Include unit tests that mock `fs` and `Date` to produce deterministic `runId` and `duration`.


Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>
