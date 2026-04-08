# RAI-68 — Part 1: Resolver types, path resolution, and config loader

**Parent ticket:** RAI-68 (RAI-68-feature-trigger_approval_feedback_resolver_configurable.md)

## Scope
Add the core types and a robust config loader plus a small path util. This part establishes the ResolverConfig interface, default values, and the loader used by other parts.

## Files to Modify
- src/types.ts — add `ResolverConfig` interface
- src/context/pathUtils.ts — add `resolveResolverConfigPath()`
- src/config/resolverConfigLoader.ts — NEW file: load/validate/merge resolver config
- __tests__/unit/resolverConfigLoader.test.ts — NEW tests for loader and defaults

## Implementation Steps
1. Add the `ResolverConfig` interface to `src/types.ts` (copy fields from parent ticket).
2. Implement `resolveResolverConfigPath(workflowDir: string): string | null` in `src/context/pathUtils.ts` that returns the path if `.raili/<workflow>/config.json` exists, else null.
3. Create `src/config/resolverConfigLoader.ts` with:
   - `getResolverConfigDefaults(): ResolverConfig`
   - `loadResolverConfig(configPath: string | null): ResolverConfig` which returns defaults when `null`, reads JSON when present, validates types, merges user values over defaults, and throws on malformed JSON or invalid types.
4. Add unit tests in `__tests__/unit/resolverConfigLoader.test.ts` to assert defaults, successful loads, malformed JSON throws, and invalid types throw.

## Acceptance Criteria
- [x] `ResolverConfig` interface added to `src/types.ts`
- [x] `resolveResolverConfigPath()` implemented and returns null when absent
- [x] `src/config/resolverConfigLoader.ts` exists and correctly merges/validates
- [x] Unit tests cover defaults, valid config, malformed JSON, and invalid types

## Context from Parent
Relevant excerpts from parent ticket:

```text
export interface ResolverConfig {
  trigger?: {
    interval?: number;        // Poll interval in seconds (default: 15)
    timeout?: number;         // Failure timeout in seconds (default: 3600)
    retry_interval?: number;  // Backoff retry interval in seconds (default: 5)
  };
  approval?: {
    timeout?: number; // Timeout in seconds (default: 3600, no retry)
  };
  feedback?: {
    timeout?: number; // Timeout in seconds (default: 3600)
  };
}
```

Also: "loadResolverConfig(configPath: string | null): ResolverConfig that returns empty object `{}` if path is null, reads JSON and validates schema, throws on malformed JSON or invalid field types, returns merged config (user values override schema defaults)".
