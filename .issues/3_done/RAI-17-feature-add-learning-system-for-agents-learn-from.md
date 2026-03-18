# RAI-17: Add learning system for agents (learn_from)

**Type:** feature

## Description
Add an opt-in learn_from field to agent states in workflow.yaml that declares explicit sources from which an agent accumulates persistent learnings across runs. Learnings are stored append-only at .raili/learnings/<agentId>.md and injected into the agent prompt under a "## Learnings from previous runs" header on subsequent executions. This enables agents to remember important outputs or variable-derived reasons without modifying agent declaration files.

## Documentation References
- documentation/output.md
- documentation/states.md
- documentation/variables.md

## Code References
- src/engine/AgentStateRunner.ts (AgentStateRunner) — integrate learn_from processing on state entry and prompt assembly
- src/handlers/agentHandler.ts (agentHandler) — ensure prompt injection and pass-through of assembled prompt
- src/workflowLoader.ts (workflowLoader) — validate learn_from syntax and referenced state existence at load time
- src/registryValidator.ts (registryValidator) — incorporate fail-fast checks for referenced state and output.store when applicable
- src/outputStore.ts (OutputStore) — read latest run from .raili/outputs/<stateId>.md
- src/variableInterpolation.ts (interpolateVariables) — validate ${VAR_NAME} syntax for var sources
- src/context.ts (Context persistence) — read context.vars at runtime for var sources
- src/pathUtils.ts (path helpers) — ensure safe path building for .raili/learnings/ files

## Acceptance Criteria
- [x] Workflow loader validates learn_from entries at load time:
      - output:<stateId> entries reference an existing state and that state has output.store: true; otherwise load fails fast
      - var:${VAR_NAME} entries validate ${...} syntax (no runtime existence check required)
- [x] On entering an agent state with learn_from:
      - Each declared source is checked; missing/empty sources are skipped silently
      - For output sources, the latest appended run is read from .raili/outputs/<stateId>.md (text after the last "--- Run ..." separator)
      - For var sources, the value is read from context.vars at runtime
- [x] New learnings are deduplicated against the existing .raili/learnings/<agentId>.md using a normalized substring match to avoid loops
- [x] New unique learnings are appended to .raili/learnings/<agentId>.md in append-only mode with UTC timestamp and source tag, e.g.:
      - "- [2026-03-18T10:32:00Z] [output:test] Tests failed: ..."
- [x] The full learnings file content is loaded and appended to the agent prompt under a heading `## Learnings from previous runs` before the agent is executed; agent declaration files remain unmodified
- [partial] Unit tests added/updated under __tests__/unit covering:
      - workflow load-time validation for learn_from entries (pending)
      - AgentStateRunner behavior: reading sources, deduplication, file append, and prompt assembly (partial: learningStore & outputStore unit tests added)
      - OutputStore reading the latest run from outputs file (added)
      - Variable interpolation validation for var sources (pending)
      - Fail-fast behavior when referenced output state missing or lacking store: true (pending)
- [ ] Integration test added under __tests__/integration that runs a small workflow with an agent state learning from a test output and a var, asserting the learnings file is created, deduplicated, and injected into the prompt
- [x] Documentation updated (documentation/states.md and documentation/output.md) with examples and the learn_from field specification
- [x] No agent declaration files in the agent registry are modified; learnings are stored only under .raili/learnings/

## Examples
Example workflow snippet to be supported:

  code:
    type: agent
    agent: raili-coding
    prompt: "work according to your rules."
    learn_from:
      - output: test
      - output: build
      - var: ${CHECK_DONE_FAILED}
    output:
      store: true
    on:
      PASSED: format


---

Notes:
- The feature must follow Raili's fail-fast and deterministic core rules: all learn_from references that can be validated at load time must be validated and cause an immediate error if invalid.
- Deduplication should use a normalization pass (trim, collapse whitespace) and substring matching to avoid repeated identical learnings across looped runs.
- Timestamp format must be ISO-8601 UTC (e.g., 2026-03-18T10:32:00Z).
