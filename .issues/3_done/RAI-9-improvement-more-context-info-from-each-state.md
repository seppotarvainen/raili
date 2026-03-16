# RAI-9: More context info from each state.

**Type:** improvement

## Description
Currently the persisted workflow context only records state name and enteredAt. Add richer, structured context for each state entry so the engine records important internals (e.g., approval question, user response and reason; notify command success/failure). This enables future UIs and debugging without changing runtime behavior.

## Documentation References
- documentation/states.md
- documentation/approval.md
- documentation/output.md
- documentation/routing.md

## Code References
- src/types.ts (StateHistoryEntry, WorkflowContext)
- src/context.ts (addStateToHistory, saveContext, loadContext, initializeContext)
- src/engine/Engine.ts (Engine.run)
- src/engine/ApproveStateRunner.ts (runApprovalStep)
- src/engine/AgentStateRunner.ts (runAgentState)
- src/engine/ScriptStateRunner.ts (runScriptState)
- src/engine/CommandStateRunner.ts (runCommandState)
- src/engine/StateRunner.ts
- src/handlers/manualHandler.ts (handleManualTransition)
- src/handlers/notifyHandler.ts (runNotify)
- src/outputStore.ts (clearAgentOutputs, output persistence)

## Acceptance Criteria
- [x] State history entries in `.raili/context.json` include new structured fields while preserving existing `state` and `enteredAt`.
  - Suggested shape per entry: `{ state, enteredAt, meta?: { notify?: { command: string, success: boolean, exitCode?: number, stderr?: string }, approval?: { question: string, chosen: "PASSED"|"FAILED", reason?: string } } }`.
- [x] Engine updates: on state entry, the engine records the notify invocation result (success/failure and optional error text) into the state's `meta.notify` before running the state handler.
- [x] Approval flow: when an approval is present the recorded history for the approval transition contains the interpolated question, the chosen outcome (PASSED/FAILED) and any reason text provided by the user in `meta.approval`.
- [x] Backwards-compatible: existing context files lacking `meta` fields continue to be parsed by `loadContext` without throwing errors.
- [x] Types updated: `src/types.ts` documents the new `StateHistoryEntry` shape and `WorkflowContext` remains compatible.
- [x] Unit tests added/updated under `__tests__/unit`:
  - Test that `addStateToHistory` persists entries with new meta fields when provided.
  - Engine unit tests (mocking handlers): verify notify failures/successes are captured, and approval results (including reason) are persisted.
  - Tests must mock `runNotify` and `handleManualTransition` so no real shell or interactive prompts run.
- [x] Documentation updated: `documentation/states.md` (and `approval.md` / `output.md` as applicable) mention the richer persisted state history format.

**Status:** Implemented in code; tests updated. 

## Implementation notes / suggestions
- Extend `StateHistoryEntry` in `src/types.ts` to include an optional `meta` object. Keep the shape permissive but documented.
- Update `addStateToHistory` signature in `src/context.ts` to accept an optional `meta` payload so callers (Engine) can attach data at the moment of adding the next state.
- Engine changes (src/engine/Engine.ts):
  - After running `runNotify(config.notify, ...)` capture the result (success/exitCode/stderr) and pass it as `meta.notify` when adding the next state to history.
  - For approval flows, `runApprovalStep` should return structured `{ chosen, reason, question }` (or Engine should capture `handleManualTransition` result) so Engine can persist `meta.approval` for that routing decision.
- Handlers:
  - `runNotify` (src/handlers/notifyHandler.ts) should return a simple `{ success: boolean, exitCode?: number, stderr?: string }` instead of void so callers can persist results. Tests should mock this.
  - `handleManualTransition` already returns `{ chosen, target, reason }`; ensure `runApprovalStep` surfaces `reason` and the interpolated question up to Engine.
- Tests:
  - Add unit tests for `context.addStateToHistory` and `loadContext` to confirm backward compatibility, and Engine tests that assert correct meta fields appended to the context after notify and approval paths.


---

Slug: more-context-info-from-each-state
