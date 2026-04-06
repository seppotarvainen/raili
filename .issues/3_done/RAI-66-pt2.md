# RAI-66 — Part 2: Manual handler updates & unit tests

**Parent ticket:** RAI-66 (RAI-66-improvement-approval-feedback-resolver-reasons.md)

## Scope
Update the manual handler to accept the new structured resolver return shapes, validate them, normalize old string returns, and add comprehensive unit tests for behavior and validation.

## Files to Modify
- src/handlers/manualHandler.ts — update types, implement executeApprovalResolver(), executeFeedbackResolver(), handleManualTransition(), and export normalizers if not in types
- __tests__/unit/handlers/manualHandler.resolvers.test.ts — add tests for object format, backward compatibility, and validation errors

## Implementation Steps
1. Import new types from src/types.ts (ApprovalResolverResult, FeedbackResolverResult)
2. Update handler function signatures to accept union return types
3. Implement normalization:
   - If resolver returns string for approval, convert to { outcome: result, reason: undefined }
   - If resolver returns string for feedback, convert to { feedback: result, metadata: undefined }
4. Add validation logic:
   - Approval object must have `outcome` with allowed values, optional `reason` (string)
   - Feedback object must have non-empty `feedback` string, optional `metadata`
   - Throw descriptive errors for invalid shapes (fail-fast)
5. Update existing handler flows to persist `reason` into context when present (e.g., meta.approval.reason)
6. Add unit tests (new and existing test updates):
   - object-format approval returns with reason
   - backward-compatible string returns
   - missing `outcome` or invalid `outcome` -> throws
   - feedback object format + backward-compatible string
   - missing `feedback` or empty `feedback` -> throws
7. Run unit tests locally and fix type errors

## Acceptance Criteria
- [ ] manualHandler accepts both old and new resolver return formats
- [ ] Validation errors thrown for invalid resolver outputs
- [ ] Unit tests added/updated and passing for the altered behavior

## Context from Parent
From Implementation Plan (relevant):

- "Modify `executeApprovalResolver()` to validate the new object shape: check `outcome` property and optional `reason`"
- "Modify `executeFeedbackResolver()` to validate the new object shape: check `feedback` property (required, non-empty string) and optional `metadata`"
- "Update `handleManualTransition()` to extract `reason` from the resolver result object when present"

See test plan in parent for example unit tests and assertion style to follow.