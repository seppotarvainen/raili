# RAI-11: Store approval reason into the context

**Type:** improvement

## Description
Store the reason text users may provide when declining an approval into the persisted workflow context so future states can access it. Keep approval metadata separate from declared input variables while also exposing a consistent env-friendly variable for scripts/notify commands.

## Documentation References
- documentation/approval.md
- documentation/variables.md
- documentation/states.md

## Code References
- src/engine/Engine.ts (run loop, approval handling)
- src/engine/ApproveStateRunner.ts (runApprovalStep → returns reason)
- src/handlers/manualHandler.ts (handleManualTransition → returns reason)
- src/types.ts (ApprovalMeta, WorkflowContext)
- src/context.ts (addStateToHistory, load/save context)
- src/handlers/notifyHandler.ts (runNotify — exposes RAILI_VAR_<UPPERCASE>)

## Proposed behaviour (implementation notes)
- Add an approvals map to the persisted context (e.g. `approvals?: Record<string,string>`) to separate approval metadata from user-declared `vars`.
- On approval decision, persist approval meta into stateHistory (existing) and also save the decline reason into `context.approvals` using a deterministic key: `<STATE>_<OUTCOME>` (uppercased). Example: for state `start` with FAILED, key = `START_FAILED`.
- To allow shell commands and notify hooks to access the reason, also mirror this value into `context.vars` under the same key so existing env export (`RAILI_VAR_<UPPERCASE>`) continues to work. This keeps runtime compatibility while maintaining a dedicated approvals structure.

## Acceptance Criteria
- [ ] When an approval `FAILED` with a typed reason, the reason is persisted in `.raili/context.json` under a dedicated `approvals` map with key `<STATE>_<OUTCOME>` (uppercased).
- [ ] The same reason is available in `context.vars` under the identical key so notify/commands can access it via `RAILI_VAR_<KEY>` (e.g. `$RAILI_VAR_START_FAILED`).
- [ ] Existing behaviour remains unchanged for PASSED approvals (no empty reasons introduced) and backward compatibility is kept for older context.json files.
- [ ] Unit tests added/updated under `__tests__/unit` verifying: Engine persists approval meta, approvals map is written, context.vars mirror exists, and env exposure via notify uses the mirrored var.
- [ ] Documentation updated: `documentation/approval.md` and `documentation/variables.md` describe the approvals map and the naming convention for the exported env variable.


Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>
