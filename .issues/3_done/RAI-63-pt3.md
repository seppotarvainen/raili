# RAI-63 — Part 3: Tests, docs, and init template

**Parent ticket:** RAI-63 (.issues/1_todo/RAI-63-feature-listen-mode.md)

## Scope
Add integration tests for the listen flow, update `init` templates/documentation to mention `trigger.js`, and add help text for `raili listen`. This part wires up examples and ensures end-to-end behavior via tests.

## Files to Modify
- src/init.ts — update workflow template to mention optional `.raili/<workflow>/trigger.js`
- documentation/ (add short note or update help text file) — document `raili listen [--workflow <name>]`
- __tests__/integration/listen.test.ts — integration tests verifying polling, run invocation, and failure timeout

## Implementation Steps
1. Update `src/init.ts` template strings to include comment: `# Optional: Create .raili/main/trigger.js for event-driven runs via 'raili listen'`.
2. Add/update documentation/help entry referencing `raili listen` and `--workflow` flag.
3. Create integration test `__tests__/integration/listen.test.ts` using existing test utils:
   - Test: exits immediately when trigger.js missing (assert thrown error)
   - Test: polls trigger, executes workflow on event, resumes polling (mock `runCommand`)
   - Test: exits after 10 minutes of consecutive failures (use fake timers)
   - Test: resets failure timer when trigger succeeds
4. Ensure integration tests mock external processes and `runCommand` similar to other integration tests.

## Acceptance Criteria
- [ ] `init` template mentions `trigger.js` discovery
- [ ] Documentation/help text updated with `raili listen` usage
- [ ] Integration tests cover core polling flows and timeouts
- [ ] Tests run using existing test harness without spawning real processes

## Context from Parent
- From parent ticket (relevant):
  - Examples, test sketches, and acceptance criteria (lines 81-171, 203-371) provide the expected behavior and test cases for integration tests and init/docs updates.

