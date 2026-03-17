# RAI-15: My title

**Type:** bug

## Description
After changes introduced in RAI-14, providing workflow inputs as a simple prompt/value no longer validates and produces the error: "Field 'inputs[0]' must be an object with 'name' and 'description'". Valid shorthand input forms (prompt/value) should be accepted, and the `description` field should be optional. When `description` is not provided, the system should gracefully fall back to the existing guidance UI/field (previously rendered as the "guides"/apply-variable helper) rather than erroring.

## Documentation References
- documentation/variables.md
- documentation/states.md
- documentation/routing.md

## Code References
- src/schemaValidator.ts (workflow input validation)
- src/schemas.ts (input schema definitions)
- src/workflowLoader.ts (parsing inputs from workflow.yaml)
- src/variableInterpolation.ts (handling of input values in prompts)
- src/types.ts (Input type definitions)
- src/cli.ts (CLI input/--var handling)

## Acceptance Criteria
- [x] The workflow loader accepts shorthand input declarations used in prompts (previous behaviour restored where appropriate).
- [x] Validation in schemaValidator.ts accepts an input item that omits `description` (treating `description` as optional) and no longer throws the "inputs[0] must be an object with 'name' and 'description'" error for valid shorthand forms.
- [ ] When `description` is omitted, the UI/CLI falls back to the prior guidance flow (the apply-variable guide) instead of treating the input as invalid.
- [x] Unit tests added/updated under __tests__/unit that cover: schema validation for inputs (including shorthand and missing description), workflowLoader parsing, and variable interpolation for prompt substitution.
- [x] Documentation updated to reflect that `description` is optional in documentation/variables.md and a short note in documentation/states.md.
- [ ] All existing tests pass (npm test) and new tests demonstrate the fixed behavior.


---

Notes:
- This is classified as a bug because a previously valid input form was rejected after RAI-14 changes.
- Suggested tests: add unit tests for schemaValidator.validateInputs (or equivalent), and for workflowLoader.parseInputs to ensure backward compatibility.
