# RAI-12: Improve approval state with multiline reason input

**Type:** improvement

## Description
Add an optional multiline input mode to approval states so users can provide longer, formatted reasons when declining an approval. This enables richer context for downstream agents or humans that consume the rejection reason. The feature should be opt-in via a state-level flag `multiline: boolean` and preserve the existing single-line behavior by default.

## Documentation References
- documentation/approval.md
- documentation/states.md
- documentation/routing.md

## Code References
- src/engine/ApproveStateRunner.ts (ApproveStateRunner)
- src/handlers/manualHandler.ts (promptMultiline / handleApprovalInput)
- src/engine/Engine.ts (state entry flow, approval routing)
- src/workflowLoader.ts (state validation: ensure `approval` + new `multiline` option allowed)
- src/types.ts (State type definitions, approval schema)

## Acceptance Criteria
- [ ] Approval states accept an optional `multiline: boolean` flag in workflow YAML (default: false).
- [ ] When `multiline: true`, manual approval prompt accepts multiple lines and terminates input when the user enters a line containing only `/q` (that line is not included in the saved reason).
- [ ] When `multiline: false` (default), approval behavior is unchanged (single-line answer or yes/no as currently implemented).
- [ ] Collected multiline reason is persisted into `.raili/context.json` for the approval state (same location/shape as existing approval responses).
- [ ] Unit tests added under `__tests__/unit/` covering:
  - ApproveStateRunner behavior with multiline true/false (mock manualHandler)
  - manualHandler multiline input termination on `/q` and correct assembled reason
  - Validation error when unknown approval options are present
- [ ] Suggested integration test under `__tests__/integration/` that runs a minimal workflow with an approval state configured `multiline: true` and asserts the persisted context contains the full multiline reason.
- [ ] Documentation updated: `documentation/approval.md` includes example YAML showing `approval.multiline: true` and explains the `/q` terminator and default behavior.
- [ ] Backward compatibility preserved: existing workflows without `multiline` continue to work without change.


---

Notes and implementation suggestions:
- Keep the new multiline input logic inside the manualHandler so handlers encapsulate side effects (per project architecture).
- Make workflow validation in `workflowLoader.ts` and `schemaValidator.ts` accept the new optional `multiline` boolean and fail-fast on unknown approval keys.
- Ensure tests mock stdin/prompt and do not spawn real interactive prompts (follow existing testing policy).

