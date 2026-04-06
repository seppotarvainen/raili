# RAI-66 — Part 1: Types & Backward-compatibility helpers

**Parent ticket:** RAI-66 (RAI-66-improvement-approval-feedback-resolver-reasons.md)

## Scope
Update core type definitions to support structured resolver returns and add small compatibility helpers/adapters so resolvers can return either the old string format or the new object format.

## Files to Modify
- src/types.ts — update ApprovalResolverFn and FeedbackResolverFn types and add related Outcome interfaces
- src/handlers/manualHandler.ts — (add exported adapter helpers; small non-breaking edits referenced here but main handler changes go in Part 2)
- src/runner/approveStateRunner.ts — (type imports) — runner changes implemented in Part 3

## Implementation Steps
1. Add new interfaces:
   - ApprovalResolverResult = { outcome: 'PASSED' | 'FAILED'; reason?: string }
   - FeedbackResolverResult = { feedback: string; metadata?: string }
2. Change exported types:
   - ApprovalResolverFn = (input) => Promise<ApprovalResolverResult | 'PASSED' | 'FAILED'>
   - FeedbackResolverFn = (input) => Promise<FeedbackResolverResult | string>
3. Export small adapter functions (e.g., normalizeApprovalResult, normalizeFeedbackResult) from manualHandler.ts or a new small util exported from types.ts so later parts can call them.
4. Add JSDoc examples showing both old and new formats.
5. Run unit tests (will be validated by Part 2 changes).

## Acceptance Criteria
- [x] src/types.ts exports the new result interfaces and union resolver types
- [x] Normalizer/adapters exist and are documented (JSDoc)
- [x] Code compiles with both old plain-string resolver modules and the new object-returning resolvers

## Context from Parent
From Implementation Plan (relevant):

- "Change `ApprovalResolverFn` to return `Promise<{ outcome: 'PASSED' | 'FAILED'; reason?: string }>` instead of `Promise<'PASSED' | 'FAILED'>`"
- "Change `FeedbackResolverFn` to return `Promise<{ feedback: string; metadata?: string }>` instead of `Promise<string>`"
- "Backward compatibility handling: Resolver functions may return either the old format (plain string) or the new format (object)"

These type changes are foundational and must be implemented first so handlers and runners can be updated safely.