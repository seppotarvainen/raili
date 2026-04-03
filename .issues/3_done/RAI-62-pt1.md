# RAI-62 — Part 1: Resolver infra, types, and path resolution

**Parent ticket:** RAI-62 (.issues/1_todo/RAI-62-feature-pluggable-approval-feedback-resolvers.md)

## Scope
Adds shared infrastructure required by both approval and feedback resolvers: path resolution helpers that locate optional resolver files under `.raili/<workflow>/`, and the necessary type additions and init/template documentation. This part is foundational and must land before resolver loading/execution.

## Files to Modify
- src/context/pathUtils.ts — add resolver path resolution helpers
- src/types.ts — add resolver-related type definitions (ApprovalResolverInput, FeedbackResolverInput, resolver function types)
- src/init.ts — document optional resolver files in scaffold/template comments
- documentation/approval.md — document resolver discovery briefly (example location)
- __tests__/unit/pathUtils.test.ts — tests verifying path resolution behavior

## Implementation Steps
1. Update `src/context/pathUtils.ts`:
   - Add `resolveApprovalResolverPath(workflowDir: string): string | null` that returns absolute path to `.raili/<workflow>/approval-resolver.js` if exists, otherwise null.
   - Add `resolveFeedbackResolverPath(workflowDir: string): string | null` similar for `feedback-resolver.js`.
   - Ensure functions are synchronous and fail-fast only on unexpected FS errors (propagate error).
2. Update `src/types.ts`:
   - Add `ApprovalResolverInput` and `FeedbackResolverInput` types and exported aliases for resolver function signatures.
   - Keep types small and focused so other parts can import them.
3. Update `src/init.ts`:
   - Add brief comments in the scaffolded workflow/template noting optional `.raili/<workflow>/approval-resolver.js` and `.raili/<workflow>/feedback-resolver.js` for unattended runs.
4. Update `documentation/approval.md`:
   - Add a short section describing resolver discovery by file presence and link to examples (full examples live in parent ticket).
5. Add `__tests__/unit/pathUtils.test.ts`:
   - Test that resolver functions return absolute path when file exists and null when missing.
   - Use temp workspace helpers consistent with repo test patterns.

## Acceptance Criteria
- [x] `resolveApprovalResolverPath()` and `resolveFeedbackResolverPath()` exist and return absolute file path when resolver file exists
- [x] Functions return `null` when resolver file is absent
- [x] Types for resolver inputs/functions are exported from `src/types.ts` and usable by handlers
- [x] Init template contains notes about optional resolver files
- [x] Unit tests for path utils pass (mocked FS via test helpers)

## Context from Parent
From the parent ticket:
- "resolveApprovalResolverPath(workflowDir: string): string | null — Returns path to `.raili/<workflow>/approval-resolver.js` or null if not found" (Implementation Plan lines 28–31)
- Resolver discovery is file-presence based; no YAML changes required (Acceptance Criteria lines 299–305).