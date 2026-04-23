# RAI-79 — Part 2: Fail-fast on `raili teach <agentId>` when agent missing

**Parent ticket:** RAI-79 (RAI-79-improvement-teach-validate-agent-exists.md)

## Scope
Ensure the CLI `raili teach` command validates the supplied agentId against the agent registry before prompting for lesson content, failing with a clear error if the agent is not defined.

## Files to Modify
- src/cli/teach.ts — load agent registry (`loadAgentRegistry`) early and throw if `agentId` not present
- __tests__/unit/cli/teach.test.ts — unit test asserting `teachCommand` throws for missing agent before prompting
- __tests__/integration/teach_cli.test.ts — integration test asserting `raili teach nonexistent_agent` exits/fails with appropriate message

## Implementation Steps
1. Import `loadAgentRegistry` from `src/registry/agentRegistry` in `src/cli/teach.ts`.
2. At start of `teachCommand(cwd, agentId)`, call `const registry = loadAgentRegistry(cwd)` and verify `registry[agentId]` exists.
3. If not present, throw an Error: `Agent '${agentId}' is not defined in agent-registry.json` (message should match parent ticket examples).
4. Ensure this check occurs before any readline prompts or file writes.
5. Add unit test (`__tests__/unit/cli/teach.test.ts`) that mocks `loadAgentRegistry` to return only `agent1` and asserts `teachCommand(cwd, 'agent2')` throws.
6. Add/adjust integration test (`__tests__/integration/teach_cli.test.ts`) to assert CLI fails when teaching nonexistent agent.
7. Run tests.

## Acceptance Criteria
- [ ] `raili teach <agentId>` fails fast when the agentId is not in agent-registry.json
- [ ] Error message clearly states agent is not defined and mentions agent-registry.json
- [ ] Tests cover both unit and integration paths

## Context from Parent
- Parent steps 2 and 6 (lines 25-33, 160-194) describe loading the agent registry in `teachCommand` and the integration test scenario.

Relevant parent excerpt:
"At the start of `teachCommand()`, load the agent registry: `const registry = loadAgentRegistry(cwd)`. Check if `agentId` exists in registry; if not, throw with message: `Error: Agent '${agentId}' is not defined in agent-registry.json`. Ensure this happens before prompting for lesson content (fail-fast)."
