# RAI-13: If variable is not present, interpolation should produce empty string

**Type:** fix

## Description
Interpolation of ${VAR} placeholders currently can leave the literal placeholder (e.g. `${MY_STATE_FAILED}`) or cause case/normalization issues. Fix interpolation so that when a referenced variable is not present in YAML-based interpolation the placeholder is replaced with an empty string. Ensure interpolation uses the exact variable name as written in YAML (case-sensitive, no automatic uppercasing). CLI-provided vars may still be uppercased for shell exports, but YAML interpolation must be exact-match and produce an empty string when missing.

## Documentation References
- documentation/variables.md
- documentation/approval.md

## Code References
- src/variableInterpolation.ts (interpolateString, interpolateObject)
- src/workflowLoader.ts (where workflow objects are loaded/processed)
- src/cli.ts (CLI var parsing / how CLI vars are passed into execution context)
- src/variableExports.ts (parseExports) — handling of exported variables from scripts/commands
- src/handlers/* (review for places that call interpolation before constructing prompts/commands)

## Acceptance Criteria
- [x] interpolateString and/or interpolation callers are changed so that missing variables in YAML interpolation produce an empty string rather than leaving `${...}` in the output or uppercasing the name.
- [x] YAML interpolation is case-sensitive: variable names must match exactly as written in YAML (e.g. `${mystate_FAILED}` is not transformed to `${MY_STATE_FAILED}`), and the substituted value is empty string if no matching key exists in context.vars.
- [x] CLI/exported variables behavior is preserved: CLI-provided vars (or values parsed via parseExports) continue to work for shell/command usage (where uppercase naming is acceptable), and any normalization that uppercases keys for CLI should not affect YAML interpolation lookup.
- [x] Unit tests added/updated under __tests__/unit/ to cover:
  - interpolateString returns empty string when a variable is missing
  - interpolateObject correctly replaces nested strings with empty string for missing vars
  - interpolation remains case-sensitive (e.g., 'mystate_FAILED' != 'MY_STATE_FAILED')
  - callers that previously relied on throwOnMissing behavior are updated and tested to confirm expected behavior
- [x] Documentation updated (documentation/variables.md) to describe the exact-match interpolation semantics and the behavior for missing variables in YAML.
- [ ] All existing tests pass (npm test) and new tests added for this behavior are green.


---

Implementation notes:
- Added `missingValue?: string` to InterpolationOptions and implemented missing-value replacement when `throwOnMissing` is false.
- Updated AgentStateRunner and ApproveStateRunner to perform YAML-style interpolation with `{ throwOnMissing: false, missingValue: '' }` so prompts/questions get empty strings for missing vars.
- Documentation updated to describe exact-match YAML interpolation and missing-variable semantics.



---

Slug: empty-string-on-missing-variable


<!-- Implementation notes (for the assignee)
- Primary change: Adjust interpolateString to provide an option/behavior where missing variables return empty string by default for YAML interpolation, or update callers to call interpolateString with throwOnMissing: false and then treat missing as empty string. Prefer making the interpolation function explicit (e.g., add option missingVarDefault: string) to avoid changing global fail-fast semantics elsewhere.
- Review all call sites of interpolateObject/interpolateString and update them to use the YAML-appropriate options.
- Ensure CLI var parsing/normalization remains unchanged; add explicit mapping when populating context.vars so that YAML interpolation uses the exact keys (no automatic uppercasing).
-->
