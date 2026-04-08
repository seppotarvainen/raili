# RAI-68 — Part 2: Make `raili listen` use resolver config

**Parent ticket:** RAI-68 (RAI-68-feature-trigger_approval_feedback_resolver_configurable.md)

## Scope
Update `src/cli/listen.ts` to load the resolver config and replace hardcoded trigger timing and backoff values with configured values. Add unit/integration tests focusing on `listen` behavior with/without config.

## Files to Modify
- src/cli/listen.ts — replace hardcoded poll/timeout/backoff with config values
- src/context/pathUtils.ts — (consumed) uses resolveResolverConfigPath() from Part 1
- src/config/resolverConfigLoader.ts — (consumed) loadResolverConfig()
- __tests__/integration/listen.config.test.ts — NEW integration test ensuring poll interval and timeouts obey config

## Implementation Steps
1. In `listenCommand()` call `resolveResolverConfigPath(workflowDir)` and `loadResolverConfig(configPath)` (from Part 1).
2. Replace `pollIntervalMs = 15_000` with `(config.trigger?.interval ?? 15) * 1000`.
3. Replace `failureTimeoutMs` hardcoded value with `(config.trigger?.timeout ?? 3600) * 1000`.
4. Replace backoff min calculation with `(config.trigger?.retry_interval ?? 5) * 1000`.
5. Add integration test `__tests__/integration/listen.config.test.ts` following repo patterns: create temp workspace, write config.json, mock timers (or spy on setTimeout), and assert intervals are honored.
6. Ensure listen logs a message when config is loaded: "Loaded resolver config from <path>" (for visibility and tests).

## Acceptance Criteria
- [x] `listen.ts` reads resolver config when present and uses interval/timeout/retry values
- [x] Default behavior unchanged when config absent
- [x] Integration test asserts configured poll interval used

## Context from Parent
Relevant plan items:

- Replace hardcoded `pollIntervalMs = 15_000` with `config.trigger?.interval ?? 15) * 1000`
- Replace hardcoded `failureTimeoutMs = (10 * 60_000)` with `(config.trigger?.timeout ?? 3600) * 1000`
- Replace hardcoded backoff `Math.min(5_000, ...)` with `(config.trigger?.retry_interval ?? 5) * 1000`

Example config snippet:
```json
{
  "trigger": { "interval": 60, "timeout": 86400, "retry_interval": 10 },
  "approval": { "timeout": 1800 },
  "feedback": { "timeout": 3600 }
}
```
