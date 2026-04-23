# RAI-79 — Part 1: Validate `teach` references during workflow validation

**Parent ticket:** RAI-79 (RAI-79-improvement-teach-validate-agent-exists.md)

## Scope
Add fail-fast validation in the workflow registry validator so any `teach` mappings that reference unknown agents cause workflow validation to fail before execution.

## Files to Modify
- src/registry/registryValidator.ts — add check in `validateWorkflowReferences()` to verify each agent id in any `state.teach` exists in the agent registry
- __tests__/integration/teach.test.ts — add/adjust integration test to assert validation throws when `teach` references nonexistent agents

## Implementation Steps
1. Open `src/registry/registryValidator.ts` and locate `validateWorkflowReferences()`.
2. After existing agent/script reference checks, iterate all workflow states and collect agent ids from `state.teach` (if present).
3. For each referenced agent id, check presence in provided `agents` registry object.
4. If any missing agents are found, throw a descriptive error listing states and missing agent ids, matching the style in the parent ticket examples.
5. Add or update `__tests__/integration/teach.test.ts` to create a temp workspace with an agent registry containing only `agent1` and a workflow referencing `agent2` in `teach` and assert `runCommand(tmp, 'clean', {})` throws with a message referencing `teach` and `agent2`.
6. Run test suite to ensure no regressions.

## Acceptance Criteria
- [ ] `validateWorkflowReferences()` reports and throws when a state's `teach` references an agent not present in agent-registry.json
- [ ] Integration test asserts validation fails before execution
- [ ] Error message clearly references the workflow state and missing agent(s)

## Context from Parent
- Implementation plan steps 1 and 6 (lines 20-24, 58-63 in parent ticket) describe adding validation in `src/registry/registryValidator.ts` and the integration test that ensures validation throws before execution.

Relevant parent excerpts:
"In `validateWorkflowReferences()`, after validating agent and script state references, add a new section to iterate all states and check the `teach` field. For each agentId key in `state.teach`, verify it exists in the `agents` registry. Collect errors and throw with a descriptive message listing all missing agents."

Example expected error from parent ticket:
"Workflow validation failed:\n  - State 'analyze': teach references agent 'unknown_agent' which is not defined in agent-registry.json"
