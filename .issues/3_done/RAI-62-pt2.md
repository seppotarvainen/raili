# RAI-62 — Part 2: manualHandler — load/execute resolvers and fallback

**Parent ticket:** RAI-62 (RAI-62-feature-pluggable-approval-feedback-resolvers.md)

## Scope
Implement resolver loading and execution in the manual handler. This includes loader helpers, execution wrappers that propagate errors (fail-fast), and extending existing `handleManualTransition()` and `handleFeedbackPrompt()` to accept optional resolver functions while preserving CLI fallback.

## Files to Modify
- src/handlers/manualHandler.ts — add loader/executor functions and optional parameters to existing handlers
- __tests__/unit/manualHandler.test.ts — unit tests for loading, executing, fallback, and fail-fast behavior

## Implementation Steps
1. In `src/handlers/manualHandler.ts`:
   - Define interfaces:
     - `ApprovalResolverInput = { question: string; stateName: string; vars?: Record<string,string>; outputPath?: string | null }`
     - `ApprovalResolverFunction = (input: ApprovalResolverInput) => Promise<'PASSED'|'FAILED'>`
     - `FeedbackResolverInput = { prompt: string; stateName: string; vars?: Record<string,string> }`
     - `FeedbackResolverFunction = (input: FeedbackResolverInput) => Promise<string>`
   - Add `loadApprovalResolver(resolverPath: string | null): ApprovalResolverFunction | null`:
     - If resolverPath is null, return null.
     - Dynamically `require(resolverPath)` and validate exported value is a function; otherwise throw.
   - Add `loadFeedbackResolver(resolverPath: string | null): FeedbackResolverFunction | null` (same semantics).
   - Add `executeApprovalResolver(resolver, input)` and `executeFeedbackResolver(resolver, input)` helpers that call resolver and re-throw any exceptions (fail-fast semantics).
   - Update `handleManualTransition()` to accept an optional `approvalResolver?: ApprovalResolverFunction` param and call `executeApprovalResolver()` when present; if absent, use existing readline CLI behavior.
   - Update `handleFeedbackPrompt()` similarly for feedback resolver and fallback to CLI.
2. Unit tests (`__tests__/unit/manualHandler.test.ts`):
   - Test loader returns function when module exports function (mock `require` or use temp file).
   - Test loader throws when exported value is not a function.
   - Test `executeApprovalResolver()` propagates resolver result and throws on resolver exceptions.
   - Test fallback path: when resolver is null, CLI prompt behavior remains (use env override `RAILI_MANUAL_CHOICE` in tests to simulate input).

## Acceptance Criteria
- [x] Loader functions return resolver functions when file exists and export is a function
- [x] Loader throws immediately if exported value is not a function
- [x] Execute helpers call resolver and propagate exceptions (fail-fast)
- [x] `handleManualTransition()` and `handleFeedbackPrompt()` accept optional resolver params and use them when provided
- [x] Backward compatibility: CLI fallback occurs when resolver is absent

## Context from Parent
From the parent ticket (summary):
- New loader and executor functions for approval and feedback resolvers (Implementation Plan lines 32–43)
- Resolver contract: Approval resolvers return 'PASSED'|'FAILED'; feedback resolvers return string (Examples lines 143–166).