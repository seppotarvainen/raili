# RAI-59 — Part 3: Agent handler changes and unit tests

**Parent ticket:** RAI-59 (RAI-59-improvement-multiple-stored-outputs.md)

## Scope
Update `executeAgent()` to accept an optional `useLatest?: number` parameter and to use `readLatestNRuns` when injecting previous outputs into the prompt. Add unit tests ensuring correct prompt construction. Depends on pt1 and pt2.

## Files to Modify
- src/handlers/agentHandler.ts — change `executeAgent` signature/logic
- __tests__/unit/handlers/agentHandler.multipleOutputs.test.ts — new unit tests

## Implementation Steps
1. Modify `executeAgent(registry, agentId, cwd, previousOutputPath?, prompt?, useLatest?: number)` (or appropriate ordering) to accept `useLatest`.
2. When `output.store` is enabled and previous output path exists, call `readLatestNRuns(cwd, stateId, useLatest)` (or equivalent) to obtain history.
3. Preserve existing logic: append `\n\nYour previous output(s):\n{history}` when history non-null/non-empty.
4. Add unit tests that mock `readLatestNRuns` and assert spawn is invoked with the expected prompt content for (a) undefined useLatest -> all outputs, (b) useLatest = N -> only latest N outputs.

## Acceptance Criteria
- [ ] `executeAgent()` accepts `useLatest?: number` and uses it when reading outputs
- [ ] Unit tests validate prompt injection behavior for undefined and defined `useLatest`

## Context from Parent
From parent ticket:
"Modify `executeAgent()` to add new parameter `useLatest?: number` and call `readLatestNRuns(cwd, stateId, useLatest)` when appropriate. Preserve the existing prompt append format."