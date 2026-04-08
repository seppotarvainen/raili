# RAI-68 — Part 4: Init scaffolding, runner wiring, integration tests, and docs

**Parent ticket:** RAI-68 (RAI-68-feature-trigger_approval_feedback_resolver_configurable.md)

## Scope
Add `generateResolverConfig()` to `src/init.ts` to scaffold `.raili/<workflow>/config.json`, update runner callsites if needed, add integration tests for listen and approval flows, and update documentation references.

## Files to Modify
- src/init.ts — add `generateResolverConfig()` and write `.raili/<workflow>/config.json` during `init`
- src/runner/approveStateRunner.ts — final wiring (if not fully covered in Part 3)
- src/runner/runner.ts — ensure feedback timeout propagation (final checks)
- __tests__/integration/listen.config.test.ts — ensure integration test(s) for listen with config present
- __tests__/integration/approval.timeout.test.ts — NEW integration test for approval timeout enforcement
- documentation/usage/listen.md — add short note about `.raili/<workflow>/config.json` (optional)

## Implementation Steps
1. Implement `generateResolverConfig()` in `src/init.ts` returning defaults matching Part 1.
2. Update `initCommand()` to write `.raili/<workflow>/config.json` with the default values during scaffold.
3. Verify runner callsites (`approveStateRunner.ts` and `runner.ts`) pass resolver config values — if necessary, add small adapters to fetch config from context or loader.
4. Add integration test `listen.config.test.ts` (if not already added in Part 2) and `approval.timeout.test.ts` to assert full end-to-end behavior in temp workspace.
5. Update documentation/usage/listen.md with a short example and mention defaults.

## Acceptance Criteria
- [ ] `init.ts` scaffolds `.raili/<workflow>/config.json` with defaults
- [ ] Runner wiring passes resolver config timeouts to approval/feedback handlers
- [ ] Integration tests for listen and approval timeout pass
- [ ] Documentation updated to mention config file

## Context from Parent

Parent plan items relevant here:

- `init.ts` to scaffold `.raili/main/config.json` during init (with defaults)
- `runner/approveStateRunner.ts` — update calls to pass approval timeout from resolver config
- Integration tests described in Test Plan (listen/integration, approval timeout)

Example defaults to scaffold:
```json
{
  "trigger": { "interval": 15, "timeout": 3600, "retry_interval": 5 },
  "approval": { "timeout": 3600 },
  "feedback": { "timeout": 3600 }
}
```
