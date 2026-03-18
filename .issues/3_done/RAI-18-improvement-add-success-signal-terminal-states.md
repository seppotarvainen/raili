# RAI-18: Add success signal for terminal states

**Type:** improvement

## Description
Add an optional `success` boolean field to terminal (engine) states so workflows can explicitly mark terminal states as successful or failed. When present the `success` value should be persisted to `.raili/context.json` for the state run; when absent it should remain null. This clarifies end-of-workflow outcomes and enables tooling to differentiate graceful completions from failures.

## Documentation References
- documentation/states.md
- documentation/routing.md
- documentation/output.md

## Code References
- src/engine/Engine.ts (Engine) - persist success flag on terminal state completion
- src/engine/StateRunner.ts (StateRunner) - pass state metadata through to engine/context
- src/engine/AgentStateRunner.ts (AgentStateRunner)
- src/engine/ScriptStateRunner.ts (ScriptStateRunner)
- src/engine/CommandStateRunner.ts (CommandStateRunner)
- src/engine/ApproveStateRunner.ts (ApproveStateRunner)
- src/context.ts (context persistence: read/write `.raili/context.json`)
- src/outputStore.ts (outputs saved per state)
- src/schemas.ts (state schema - add optional `success?: boolean | null`)
- src/schemaValidator.ts (validate `success` is boolean if present)
- src/workflowLoader.ts (ensure success is allowed in merged workflow config)

## Acceptance Criteria
- [x] Workflow state definition accepts an optional `success` boolean on engine (terminal) states. If omitted, the value recorded in context.json for that state's `success` is null.
- [x] When a terminal state with `success: true` is entered and completed, `.raili/context.json` records that state's `success: true` in the state run entry.
- [x] When a terminal state with `success: false` is entered and completed, `.raili/context.json` records `success: false`.
- [x] Existing behavior unchanged when `success` is not present (no default true/false applied).
- [x] Schema validation (schemas.ts + schemaValidator.ts) enforces `success` is boolean when present; invalid types produce a fail-fast error.
- [x] Unit tests added under __tests__/unit covering: Engine terminal state handling, context persistence of success, schema validation for `success` present/absent/invalid.
- [ ] Integration test suggested under __tests__/integration that runs a short workflow with two terminal states (one success:true, one success:false) and asserts final context.json contains correct success flags.
- [x] Documentation updated: documentation/states.md includes field description and example YAML; routing.md or output.md updated if relevant.


<!-- Ticket generated automatically by issue-ticket-generator -->
