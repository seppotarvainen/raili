# RAI-79 — Part 3: Runner `handleTeach()` should validate agents before writing learnings

**Parent ticket:** RAI-79 (RAI-79-improvement-teach-validate-agent-exists.md)

## Scope
Add validation to the runner's `handleTeach()` so that when a workflow state declares `teach: { ... }`, all referenced agent IDs must exist in the runner's `agentRegistry`. If missing, throw before any learning store operations occur.

## Files to Modify
- src/runner/runner.ts — in `handleTeach()` verify all agentIds in the `teach` mapping exist in `this.agentRegistry` and throw a comprehensive error if any are missing
- __tests__/unit/runner/runner.teach.test.ts — unit test ensuring `handleTeach` throws when `teach` references unknown agent(s) and does so before any learning store ops

## Implementation Steps
1. Open `src/runner/runner.ts` and locate `handleTeach()` (or equivalent function handling the `teach` phase).
2. At the start of `handleTeach()`, collect all agent ids present in the state's `teach` mapping.
3. Compare them against keys in `this.agentRegistry`. If any are missing, throw an Error listing all missing agent ids (e.g., "Missing agents in teach: agent2, agent3").
4. Ensure no calls to learning store (or filesystem writes) occur before this check.
5. Add unit test (`__tests__/unit/runner/runner.teach.test.ts`) that constructs a Runner instance with a minimal `agentRegistry` and a state containing `teach: { agent2: [...] }` and asserts `handleTeach()` throws with a message containing `agent2`.
6. Run unit tests.

## Acceptance Criteria
- [ ] `handleTeach()` throws when state's `teach` references unknown agents
- [ ] Error message clearly lists missing agent(s)
- [ ] No learning store writes occur if validation fails

## Context from Parent
- Parent steps 3 and 42-47 (lines 31-34, 42-47) require runner-level validation to ensure workflow execution fails immediately if `teach` references an invalid agent.

Parent excerpt:
"At the start of `handleTeach()`, before the loop, verify that all agentIds in the `teach` mapping exist in `this.agentRegistry`. Collect missing agents and throw a comprehensive error listing them all. This ensures workflow execution fails immediately if teach references an invalid agent."