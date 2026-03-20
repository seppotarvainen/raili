# RAI-28: Add feedback attribute for capturing free-form user input as a workflow variable

**Type:** feature

## Description
Add a reusable `feedback:` block that can be attached to any state (engine, agent, script, command). It pauses execution after the state finishes (and after `approval:` if present), prompts the user for free-form text, persists the value to the workflow context as a variable, and exposes it to downstream states via `${name}` interpolation and `RAILI_VAR_<NAME>` environment variables. This provides a simple data-capture primitive (commit messages, review notes) without affecting routing.

## Documentation References
- documentation/approval.md
- documentation/variables.md
- documentation/states.md

## Code References
- src/engine/Engine.ts (Engine.run)
- src/context.ts (saveContext, loadContext, addStateToHistory, initializeContext)
- src/engine/ApproveStateRunner.ts (runApprovalStep)
- src/handlers/manualHandler.ts (handleManualTransition) — consider reuse or add handleFeedbackPrompt
- src/engine/AgentStateRunner.ts (prompt interpolation)
- src/engine/ScriptStateRunner.ts (envOverrides → RAILI_VAR_<NAME>)
- src/engine/CommandStateRunner.ts (envOverrides → RAILI_VAR_<NAME>)
- src/registryValidator.ts (validateWorkflowReferences) — add collision checks and mandatory expose_var validation
- src/variableInterpolation.ts (interpolateString/interpolateObject)
- src/types.ts (add FeedbackConfig type and state schema)

## Acceptance Criteria
- [x] `feedback:` is accepted on any state type alongside other optional blocks (`notify`, `output`, `approval`, etc.)
- [x] Input is collected after state execution, after `approval` (if both present)
- [x] Value is persisted to `.raili/<workflow>/context.json` and survives resume
- [x] Value is available for interpolation as `${expose_var}` and exported to child processes as `RAILI_VAR_<UPPERCASE_NAME>`
- [x] `required: true` re-prompts on empty input until non-empty provided
- [x] Missing `expose_var` causes startup validation error
- [x] `expose_var` collision with declared workflow `inputs` causes fail-fast startup error in registryValidator
- [x] `RAILI_FEEDBACK_<UPPERCASE_NAME>` env var bypasses stdin and provides the value (for CI/automated tests)
- [x] `multiline: true` option supported for collecting multi-line text (terminator or `/q` semantics)
- [x] Unit tests cover: happy path, required re-prompt, empty-allowed, CI override, collision error
- [x] Integration test covers end-to-end: feedback captured → variable used in downstream command
- [x] Integration test file added: `__tests__/integration/feedback.multiline.integration.test.ts`
- [x] Integration test file added: `__tests__/integration/feedback_attribute.integration.test.ts`

### Notes
- Created integration test verifying multiline feedback via `RAILI_FEEDBACK_<NAME>` is captured and exported to downstream commands.
- Test path: `__tests__/integration/feedback.multiline.integration.test.ts`
- This satisfies the requirement to add an integration test whenever new fields are introduced.


