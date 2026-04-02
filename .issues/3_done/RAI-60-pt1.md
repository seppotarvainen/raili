# RAI-60 — Part 1: Types, Schema, and Validation

**Parent ticket:** RAI-60 (RAI-60-feature-add-reset-max-visits.md)

## Scope
Add the new StateConfig field `reset_max_visits?: string[]` to types and runtime schema, and implement fail-fast validation that ensures every referenced state exists. This part provides the foundational infra other parts depend on.

## Files to Modify
- src/types.ts — add `reset_max_visits?: string[]` to StateConfig
- src/workflow/schemas.ts — add `reset_max_visits` schema to StateConfigSchema
- src/workflow/stateValidator.ts — validate referenced state IDs exist (fail-fast)
- __tests__/unit/runner/runner.maxvisits.test.ts — add validation test case for nonexistent target

## Implementation Steps
1. Update `StateConfig` in `src/types.ts` with: `reset_max_visits?: string[]` and export any affected types.
2. Update `src/workflow/schemas.ts` `StateConfigSchema` to include an optional `reset_max_visits` property (type: array of strings) with a helpful description.
3. Extend `src/workflow/stateValidator.ts` to validate that every state ID listed in `reset_max_visits` exists in the workflow; throw a clear error at load-time if not.
4. Add a unit test in `__tests__/unit/runner/runner.maxvisits.test.ts` that constructs a workflow referencing a nonexistent state in `reset_max_visits` and asserts validation fails with the expected message.
5. Run the unit tests to ensure only validation behavior is covered in this part.

## Acceptance Criteria
- [ ] `reset_max_visits` is present in `StateConfig` as `string[] | undefined`
- [ ] Schema contains `reset_max_visits` with correct type and description
- [ ] Validator fails fast when a referenced state does not exist (test added and passing)
- [ ] This part compiles and its tests pass in isolation

## Context from Parent
- Description: Add `reset_max_visits` field that allows a state to reset visit counters for specified downstream states when entered to support nested loops without shared limits.
- Code references: src/types.ts, src/workflow/schemas.ts, src/workflow/stateValidator.ts
- Test plan: "reset_max_visits fails if target state does not exist" (unit test to assert validation throws before execution)
