# RAI-75 — Part 1: Runners interpolation + unit tests (script only)

**Parent ticket:** RAI-75 (RAI-75-bug-script_command_variable_interpolation.md)

## Scope
Implement variable interpolation in the script state runner and add unit tests verifying successful interpolation and fail-fast behavior on missing variables. This is the foundational change other tests rely on.

## Files to Modify
- src/runner/scriptStateRunner.ts — interpolate `args` using `interpolateObject` before execution

## Files to Add / Modify (tests)
- __tests__/unit/runner/scriptStateRunner.test.ts — add tests for interpolation and missing-variable error

## Implementation Steps
1. Update src/runner/scriptStateRunner.ts:
   - Import `interpolateObject` from `src/variables/variableInterpolation`.
   - Before calling executeScript, run interpolation on `state.args` with `{ throwOnMissing: true }` and pass the resulting args to executeScript.
   - Ensure any thrown interpolation errors surface as run errors (fail-fast).
2. Add unit tests in __tests__/unit/runner/scriptStateRunner.test.ts:
   - "interpolates variables in script args" (happy path)
   - "throws when interpolating undefined variable in script args" (error path)
   - Mock executeScript to capture the passed args.
3. Run unit tests (npm test) locally to ensure unit-level correctness.

## Acceptance Criteria
- [ ] src/runner/scriptStateRunner.ts interpolates `args` using `interpolateObject` with fail-fast
- [ ] Unit tests added for happy-path interpolation and missing-variable error for the script runner
- [ ] Unit tests pass locally

## Context from Parent
(Selected relevant excerpts)

- Code References:
  - src/runner/scriptStateRunner.ts (runScriptState)
  - src/variables/variableInterpolation.ts (interpolateObject)

Please refer to the parent ticket for full integration test plans and examples.