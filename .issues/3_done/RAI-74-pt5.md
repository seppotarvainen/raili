# RAI-74 — Part 5: Documentation and integration tests

**Parent ticket:** RAI-74 (RAI-74-feature-make-learnings-global-by-default.md)

## Scope
Update documentation to describe global vs workflow learnings, examples, and add integration tests that validate cross-workflow sharing and workflow-local overrides.

## Files to Modify / Create
- documentation/output.md — update learnings section with new global behavior and merging rules
- documentation/states.md — update teach examples to show scope usage
- __tests__/integration/learnings.integration.test.ts — integration tests validating end-to-end behavior across workflows

## Implementation Steps
1. Update documentation/output.md to include the new `.raili/learnings/` directory, merge behavior, and examples from the parent ticket.
2. Update documentation/states.md teach examples to demonstrate `scope: workflow` and default global behavior.
3. Create integration tests following repository patterns (use testUtils helpers) that:
   - Run a workflow which teaches (default global) and assert global file created
   - Run a second workflow and assert global learnings are included in agent prompt
   - Verify workflow-local scope writes to workflow dir and overrides global when present
4. Mock child_process.spawn as in other integration tests to avoid real external calls.
5. Run integration tests locally (CI will run full suite).

## Acceptance Criteria
- [ ] Documentation reflects new global/default behavior and merging rules
- [ ] Integration tests verify cross-workflow sharing and workflow-local overrides
- [ ] All new tests pass in CI

## Context from Parent
Relevant excerpts:
- Examples and expected behavior sections (lines 109–156)
- Integration test pseudocode and guidance (lines 217–324, 326–362)
