# RAI-14: Show description of the input

**Type:** improvement

## Description
When prompting for declared workflow inputs on a clean run, display an optional human-friendly description (if provided) before asking for the value. Accept a richer `inputs:` declaration in workflow.yaml where each input can be an object `{ name, description }` (description optional). This makes interactive prompts clearer and improves UX when collecting required variables.

## Documentation References
- documentation/variables.md
- documentation/states.md

## Code References
- src/cli.ts (collectVars, promptLine) — prompt flow and interactive input collection
- src/workflowLoader.ts (loadWorkflowConfig) — reading `inputs` from workflow.yaml
- src/schemaValidator.ts (validateWorkflowConfig) — validate new inputs shape
- src/types.ts (WorkflowConfig.inputs) — add Input definition type (name, description?)

## Acceptance Criteria
- [x] Workflow accepts `inputs:` declared as an array of objects: `- name: <key>\n  description: "..."` as well as the legacy simple string array (backwards compatibility optional).
- [x] On a clean `raili run`, for each missing input that has a `description`, the CLI prints the description (multi-line allowed) followed by a prompt of the form: `> <name>: ` and records the entered value.
- [x] If `inputs:` contains entries in an unexpected format, the system fails fast using the existing validation/error flow (no silent fallback).
- [x] `loadWorkflowConfig` and schema validation are updated to accept and validate the new input shape; unit tests cover valid and invalid formats.
- [x] Unit tests added under `__tests__/unit`:
  - workflowLoader tests for parsing `inputs` as objects and strings
  - cli tests mocking `readline` to assert the description is printed and the prompt is shown
- [x] Documentation updated (documentation/variables.md) with examples of the new `inputs:` syntax and an example prompt exchange.
- [ ] `npm test` passes (existing tests unaffected; new tests added and passing).

