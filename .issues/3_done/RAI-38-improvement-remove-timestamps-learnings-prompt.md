# RAI-38: Remove timestamps from learnings when injecting into prompt

**Type:** improvement

## Description
Agents currently receive the full learnings file content verbatim, including per-entry timestamps and source tags (e.g. "- [2026-03-23T...] [output:state]"). These timestamps add noise and consume tokens without aiding agent decisions. This change strips timestamp metadata from stored learnings when they are injected into agent prompts, preserving the lesson text and source tag only if helpful, to reduce prompt size and improve signal-to-noise.

## Documentation References
- docs/workflow-yaml.md (Agent memory / learnings sections)

## Code References
- src/context/learningStore.ts (extractLessons, appendUniqueLearning, readLearnings)
- src/runner/AgentStateRunner.ts (AgentStateRunner.run, runAgentState)
- src/handlers/agentHandler.ts (executeAgent) — for prompt assembly behavior
- src/context/pathUtils.ts (learningsFilePath)
- __tests__/integration/testUtils.ts (fakeChild, createTmpWorkspace helpers)
- __tests__/integration/agent.test.ts (integration patterns for agents)

## Implementation Plan
Ordered steps to implement the improvement. Each step references a concrete file and function.

1. **src/context/learningStore.ts** — Add a new exported helper `readLearningsForPrompt(cwd: string, agentId: string, workflowArg?: string): string`.
   - Implementation: Read the learnings file (use existing learningsFilePath via import), parse it into stored entries, and return the concatenated lesson bodies with metadata stripped of timestamps. Preserve source tags if present (e.g. keep `[output:state]` or convert to a compact label) but remove ISO timestamps in square brackets. If the file is empty or no lessons exist, return an empty string.
   - Add an internal helper `stripTimestampsFromLearnings(content: string): string[]` (or similar) to robustly parse blocks that follow the existing storage format (`- [<timestamp>] [<sourceTag>]\n\n<lesson>\n\n`). Ensure multiline lessons keep internal newlines.
   - Keep `readLearnings()` unchanged (it should continue returning raw file content for other uses such as debugging or audit). Export the new helper next to existing exports.

2. **src/runner/AgentStateRunner.ts** — Replace the call site that currently does `const fullLearnings = readLearnings(...)` with `const fullLearnings = readLearningsForPrompt(...)` (import the new function). This ensures only cleaned learnings are injected into the prompt.
   - Verify assembledPrompt behavior remains: only prepend learnings when an explicit prompt exists.

3. **src/handlers/agentHandler.ts** — No change to storage format here. Confirm that executeAgent still uses the prompt string as-is. Add a short comment referencing that learnings are stripped of timestamps upstream.

4. **Unit tests:** Add/modify unit tests to assert the new behavior.
   - **__tests__/unit/learningStore.test.ts** — New file: test `stripTimestampsFromLearnings`/`readLearningsForPrompt` with sample content that includes multiple appended entries (with timestamps & source tags) and assert returned prompt text contains only lesson bodies and optional compact source tags but no ISO timestamps.
   - **__tests__/unit/AgentStateRunner.test.ts** — New test: mock `readLatestRun` and `appendUniqueLearning` (or use small temp dirs) and mock `executeAgent` to capture the prompt argument passed. Assert the prompt passed to executeAgent contains the cleaned learnings (no timestamps) and still contains the prompt text.

5. **Integration test:** Add an integration test that follows established patterns.
   - **__tests__/integration/learnings-injection.test.ts** — Using `createTmpWorkspace()` write a pre-populated `.raili/main/learnings/<agentId>.md` containing two appended entries (the exact storage format produced by appendUniqueLearning, with timestamps). Register an agent and workflow with a prompt. Mock `child_process.spawn` to capture the copilot call (use `fakeChild`) and assert the `--prompt` value (args after `--prompt`) does not contain ISO timestamps but does contain lesson text.
   - Use `cleanupRailiEnvVars()` and `cleanupTmpWorkspace()` as per patterns.

6. **Documentation update (optional):** docs/workflow-yaml.md — add a short note in "Agent memory" section that learnings are stored with timestamps for audit, but timestamps are removed when injected into agent prompts to reduce token usage.

7. **Run tests:** Execute `npm test` and adjust tests as necessary until all unit and integration tests pass. Ensure no other tests rely on readLearnings() returning a timestamp-stripped string.

## Examples
Concrete before/after examples showing prompt assembly.

### Example learnings file (existing storage format)
```
- [2026-03-23T19:00:00.000Z] [output:code]

Lesson: Remember to run `npm run build` before tests.

- [2026-03-23T19:10:00.000Z] [var:ticket_id]

Lesson: Ticket IDs should be validated for format PROJ-\d+.
```

### Before (current injected prompt)
```
Analyze the code for TICKET-123

## Learnings from previous runs
- [2026-03-23T19:00:00.000Z] [output:code]

Lesson: Remember to run `npm run build` before tests.

- [2026-03-23T19:10:00.000Z] [var:ticket_id]

Lesson: Ticket IDs should be validated for format PROJ-\d+.
```

### After (expected injected prompt)
```
Analyze the code for TICKET-123

## Learnings from previous runs
[output:code]
Lesson: Remember to run `npm run build` before tests.

[var:ticket_id]
Lesson: Ticket IDs should be validated for format PROJ-\d+.
```

Notes: ISO timestamps removed; source tag preserved in compact line. Alternatively, if preserving source tag is undesirable, it can be removed — tests should assert the timestamps are gone and lesson text preserved.

## Test Plan

### Unit tests (__tests__/unit/)

- File: __tests__/unit/learningStore.test.ts
  - Test case: "strip timestamps and preserve lesson bodies"
    - Setup: create a sample learnings file string w/ two appended entries (as above). Call `stripTimestampsFromLearnings()` or `readLearningsForPrompt()` with an in-memory temp file or by writing to workspace and using learningsFilePath.
    - Act: read result
    - Assert: result does not contain ISO timestamps (match regex /\d{4}-\d{2}-\d{2}T/ should fail), contains both lesson bodies, and preserves internal newlines.

- File: __tests__/unit/AgentStateRunner.test.ts
  - Test case: "AgentStateRunner injects cleaned learnings into prompt"
    - Setup: Mock `appendUniqueLearning` and `readLatestRun` (or write a temp learnings file). Mock `executeAgent` to capture the prompt argument. Create a minimal `state` object with `prompt: 'Analyze this'` and `config.learn_from` disabled or set such that learnings exist.
    - Act: call `runAgentState()` with the mocked registry
    - Assert: `executeAgent` received a prompt that includes '## Learnings from previous runs' and that no ISO timestamp substrings exist; lesson text is present.

### Integration tests (__tests__/integration/)
Follow patterns in testUtils.ts and agent.test.ts.

- File: __tests__/integration/learnings-injection.test.ts
  - Test case: "learned entries are injected without timestamps"
    - Setup:
      - const tmp = createTmpWorkspace();
      - writeAgentRegistry(tmp, { test_agent: { path: './agents/test.agent.md' } });
      - writeAgentFile(tmp, 'agents/test.agent.md', 'Agent instructions');
      - Pre-populate .raili/main/learnings/test_agent.md with two appended entries containing timestamps (writeFileSync on path returned by learningsFilePath or via test workspace layout).
      - writeWorkflow(tmp, minimal workflow with an `analyze` agent state that has prompt: "Analyze" and transitions to done)
      - jest.mock('child_process', () => ({ spawn: jest.fn() }));
      - spawn.mockImplementation((cmd: string) => cmd === 'copilot' ? fakeChild('done', '', 0) : fakeChild('', '', 0));
    - Act: await runCommand(tmp, 'clean', {});
    - Assert:
      - Find the copilot call in spawn.mock.calls and extract the `--prompt` argument.
      - Expect the prompt string to contain lesson bodies but not ISO timestamps (e.g., expect(prompt).not.toMatch(/\d{4}-\d{2}-\d{2}T/));
      - Expect workflow to reach terminal state `done`.

### Mock patterns and cleanup
- Use `fakeChild(stdout, stderr, exitCode)` from testUtils to simulate copilot output.
- Use `createTmpWorkspace()` and `cleanupTmpWorkspace(tmp)`.
- Use `cleanupRailiEnvVars()` in afterEach.

## Acceptance Criteria
- [x] New helper `readLearningsForPrompt` exists and returns learnings with ISO timestamps removed but lesson bodies preserved.
- [x] AgentStateRunner uses the new helper when assembling prompts; injected prompts do not contain ISO timestamps.
- [x] Append storage format (appendUniqueLearning) remains unchanged (timestamps still stored on disk for audit).
- [x] Unit tests covering the stripping logic and prompt assembly are added and pass.
- [ ] Integration test verifying that copilot `--prompt` does not contain timestamps is added and passes.


---

**Ticket summary:** RAI-38, improvement, file: .issues/1_todo/RAI-38-improvement-remove-timestamps-learnings-prompt.md
