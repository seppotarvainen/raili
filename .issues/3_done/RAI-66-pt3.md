# RAI-66 — Part 3: Runner updates, integration tests & documentation

**Parent ticket:** RAI-66 (RAI-66-improvement-approval-feedback-resolver-reasons.md)

## Scope
Modify approval and feedback state runners to consume the normalized resolver outputs (including reason/metadata), persist these into context and vars, add integration tests verifying persistence and backward compatibility, and update documentation.

## Files to Modify / Add
- src/runner/approveStateRunner.ts — extract `reason` from resolver result, include in ApprovalOutcome, persist to context in run loop
- src/runner/feedbackStateRunner.ts — extract `feedback` and `metadata` and return/persist appropriately
- __tests__/integration/approval-resolver.integration.test.ts — add test for reason persistence
- __tests__/integration/approval-resolver-failure.integration.test.ts — add failure case asserting reason saved
- __tests__/integration/feedback-resolver.integration.test.ts — add metadata test
- documentation/approval.md — update Pluggable Approval & Feedback Resolvers section with new shapes and examples

## Implementation Steps
1. Import the normalized result types from src/types.ts or use normalizer helpers
2. Update runApprovalStep() to accept normalized result and place `reason` into:
   - stateHistory[].meta.approval.reason
   - context.approvals[<STATE>_<OUTCOME>] = reason
   - context.vars[<STATE>_<OUTCOME>] = reason (so env var export matches spec)
3. Update runFeedbackStep() to persist feedback into exposed var and metadata to a documented location (e.g., context.feedbacks[<STATE>]) when store option enabled
4. Ensure backward compatibility by supporting string-only resolver outputs via normalizers from Part 1
5. Update or add integration tests demonstrating:
   - resolver returns object with reason -> reason is present in context and env var
   - resolver returns string -> behavior unchanged
   - feedback returns metadata -> accessible in context
6. Update documentation/approval.md examples and note backward compatibility
7. Run integration tests (mocked spawn) and adjust as needed

## Acceptance Criteria
- [ ] Approvals and feedback runners correctly receive and persist reason/metadata
- [ ] Integration tests added and passing in CI
- [ ] Documentation updated with examples and backward-compat note

## Context from Parent
Relevant plan excerpts:

- "Modify `runApprovalStep()` to extract `reason` from the resolver execution result"
- "Ensure `reason` is properly returned in the `ApprovalOutcome` (already present in the interface)"
- "Return both `feedback` and `metadata` in the feedback outcome"
- Integration test sketches in parent ticket show expected assertions for context and vars persistence

This part wires the types and handler changes into the runners and verifies end-to-end behavior via integration tests and docs updates.