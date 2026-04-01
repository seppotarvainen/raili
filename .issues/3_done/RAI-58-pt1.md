# RAI-58 — Part 1: Core types, schema and validation

**Parent ticket:** RAI-58 (RAI-58-feature-continue-transition.md)

## Scope
Add the `continue` routing field to the type system and runtime validation so other parts can rely on a validated state definition. Include unit tests covering mutual-exclusivity rules.

## Files to Modify
- src/types.ts — add `continue?: string` to StateConfig
- src/workflow/schemas.ts — add `continue` schema entry to StateConfigSchema
- src/workflow/stateValidator.ts — enforce mutual exclusivity (continue vs on/transitions/approval)
- src/workflow/workflowValidator.ts — ensure a state cannot define more than one routing option
- __tests__/unit/stateValidator.test.ts — add tests for invalid combos

## Implementation Steps
1. Add `continue?: string` to StateConfig in src/types.ts adjacent to `on` and `transitions`.
2. Add the `continue` schema entry in src/workflow/schemas.ts (type: string, required: false, description).
3. Update validateStateConfig() in src/workflow/stateValidator.ts to throw when `continue` coexists with any of `on`, `transitions`, or `approval` with clear error messages.
4. Update workflow-level routing validation in src/workflow/workflowValidator.ts to treat `continue` as one of the mutually exclusive routing options.
5. Add unit tests in __tests__/unit/stateValidator.test.ts for the three invalid combinations (`continue`+`on`, `continue`+`transitions`, `continue`+`approval`) and for missing continue target detection where appropriate.
6. Run unit tests and fix typings.

## Acceptance Criteria
- [ ] `continue` added to StateConfig in src/types.ts
- [ ] `continue` schema added in src/workflow/schemas.ts
- [ ] validateStateConfig enforces mutual exclusivity and throws descriptive errors
- [ ] workflowValidator treats `continue` as a routing option and fails fast on invalid config
- [ ] Unit tests present and passing for validator behavior

## Context from Parent
- "Introduce a built-in `continue` transition that unconditionally routes to a next state regardless of outcome... The `continue` key will be a top-level routing option on any state, mutually exclusive with `on`, `transitions`, and `approval`."

- Implementation Plan (relevant):
  1. Add `continue?: string` to src/types.ts
  2. Add schema entry in src/workflow/schemas.ts
  3. Update validateStateConfig() to enforce mutual exclusivity
  6. Update mutual exclusivity validation in workflowValidator.ts

(See parent ticket for full examples and tests.)