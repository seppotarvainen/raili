# RAI-49: Remove tags from lessons given to an agent

**Type:** improvement

## Description
Remove source tags (e.g. `[var:FOO]`, `[manual]`, `[output:state]`) from lessons when injecting them into an agent prompt. Rationale: agents do not need metadata about where a lesson originated; removing tags reduces token usage and provides cleaner, actionable lessons. Preserve lesson bodies and multiline formatting, but present them as bullet items in the prompt.

## Documentation References
- documentation/output.md

## Code References
- src/context/learningStore.ts (extractLessons, stripTimestampsFromLearnings, readLearningsForPrompt, appendUniqueLearning)
- src/runner/agentStateRunner.ts (AgentStateRunner.run) — uses readLearningsForPrompt to inject learnings
- __tests__/unit/context/learningStore.test.ts (unit tests to update)
- __tests__/unit/runner/agentPromptInterpolation.test.ts (mock patterns)
- __tests__/integration/testUtils.ts (integration mock helpers)

## Implementation Plan
Ordered steps (apply in order):

1. **src/context/learningStore.ts** — Modify stripTimestampsFromLearnings to strip any source tag and return only the lesson body. Format each returned lesson as a bullet: the first line prefixed with "- ", subsequent lines indented by two spaces to preserve multiline appearance. Ensure literal "\\n" sequences in stored files are decoded back to real newlines and preserved.

2. **src/context/learningStore.ts** — Ensure readLearningsForPrompt still calls stripTimestampsFromLearnings and returns joined lessons (keep current join with \n\n). No changes to appendUniqueLearning semantics (storage format unchanged).

3. **src/runner/agentStateRunner.ts** — Confirm usage of readLearningsForPrompt still matches expected bullet format; no code change required unless presentation/header needs change. Keep injection header `## Learnings from previous runs` as-is.

4. **__tests__/unit/context/learningStore.test.ts** — Update expectations in `stripTimestampsFromLearnings` tests: remove assertions expecting source tags; assert lessons are bullet-prefixed and decoded. Add new assertions demonstrating multiline indentation.

5. **__tests__/unit/runner/agentPromptInterpolation.test.ts** — No functional change required; ensure mocks of learningStore still work. If any test asserts presence of source tags in prompt, update to expect bullet-prefixed lesson bodies instead.

6. **__tests__/integration/** — Add or update an integration test that writes a learnings file with timestamped lines containing source tags and verifies the agent prompt receives bullet-only lessons (use existing testUtils.fakeChild and runCommand patterns). Use createTmpWorkspace(), writeAgentRegistry(), writeAgentFile(), writeWorkflow() helpers.

7. Run the existing test suite: `npm test`. Fix any failing tests caused by expectation changes (update unit tests as needed).

8. Update documentation snippet in documentation/output.md (small note stating that source tags are removed when injecting lessons into prompts) — optional but recommended.

## Examples

### Before (current prompt injected to agent)
```
Analyze ticket PROJ-1

## Learnings from previous runs
[output:check_tests]
Always do integration tests if they're requested. Integration tests are located in __tests__/integration.

[manual]
Respect existing test structure. Tests should correlate with production code structure.
```

### After (desired prompt injected to agent)
```
Analyze ticket PROJ-1

## Learnings from previous runs
- Always do integration tests if they're requested. Integration tests are located in __tests__/integration.
- Respect existing test structure. Tests should correlate with production code structure.
```

### Example stored learnings file (on disk, unchanged)
```
- [2026-03-25T07:17:17.645Z] [var:CHECK_DONE_FAILED] Always do integration tests if they're requested. Integration tests are located in __tests__/integration.\n
- [2026-03-26T12:27:56.168Z] [manual] Respect existing test structure. Tests should correlate with production code structure.\n
```

### Example output from readLearningsForPrompt(cwd, agentId)
```
- Always do integration tests if they're requested. Integration tests are located in __tests__/integration.

- Respect existing test structure. Tests should correlate with production code structure.
```

## Test Plan

### Unit tests (`__tests__/unit/`)
- **File:** `__tests__/unit/context/learningStore.test.ts`
  - **Test case:** "stripTimestampsFromLearnings strips source tags and bullet-prefixes lesson"
    - Setup: create a sample string with two stored lines (timestamp + source tag + escaped newlines)
    - Act: call stripTimestampsFromLearnings(sample)
    - Assert:
      - returns array length 2
      - entries do NOT contain bracketed source tags (e.g., no `[output:...]` or `[manual]`)
      - entries contain decoded newlines (real \n characters)
      - entries are bullet-prefixed: first line starts with `- ` and subsequent lines are indented by two spaces

- **File:** `__tests__/unit/context/learningStore.flattened.test.ts` (no change expected other than that readLearnings continues to contain stored lines).

- **File:** `__tests__/unit/runner/agentPromptInterpolation.test.ts`
  - **Test case:** "agent prompt receives bullet-prefixed learnings when present"
    - Setup: mock learningStore.readLearningsForPrompt to return the bullet-formatted string
    - Act: call runAgentState with a prompt
    - Assert: agentHandler.executeAgent called with assembledPrompt containing `## Learnings from previous runs` and the bullet lines (do not assert presence of any source tags)

### Integration tests (`__tests__/integration/`)
Follow helpers in `__tests__/integration/testUtils.ts`.

- **File:** `__tests__/integration/learnings-to-agent.test.ts` (new)
  - **Test case:** "learnings on disk are stripped of tags before being injected into agent prompt"
    - Setup:
      - tmp = createTmpWorkspace()
      - writeAgentRegistry(tmp, { 'an.agent': { path: './agents/a.md' } })
      - writeAgentFile(tmp, '.github/agents/a.md', '# Agent')
      - writeWorkflow(tmp, `initial: start\nstates:\n  start:\n    type: agent\n    agent: an.agent\n    prompt: 'Run check'\n    on: { PASSED: done }\n`)
      - Write a learnings file at `.raili/main/learnings/an.agent.md` containing two timestamped lines with source tags (use the same format as storage)
    - Mock child_process.spawn so copilot/fake child receives the assembled prompt: make fakeChild capture stdout/stderr and assert spawn called with assembledPrompt that contains bullet lines and no bracketed tags.
    - Act: run the engine (use runCommand helper used by other integration tests)
    - Assert: spawn.mock.calls include assembled prompt without source tags; context final state is reached.

## Acceptance Criteria
- [x] stripTimestampsFromLearnings no longer includes source tags in its returned entries
- [x] readLearningsForPrompt returns bullet-prefixed lesson bodies (no bracketed tags) joined with a blank line between lessons
- [x] Unit tests updated and passing for learningStore behavior
- [x] Integration test confirms on-disk learnings with tags are injected to agents without tags
- [x] Documentation (documentation/output.md) notes that source tags are removed when injecting lessons into agent prompts

Notes: Implementation already present in src/context/learningStore.ts; tests and integration coverage aligned. Documentation updated to reflect behavior.

---

Ticket ID: RAI-49
Type: improvement
Filename: .issues/1_todo/RAI-49-improvement-remove-tags-from-lessons.md
