# RAI-74 — Part 2: Runner and agent integration for merged learnings

**Parent ticket:** RAI-74 (RAI-74-feature-make-learnings-global-by-default.md)

## Scope
Wire the merged learnings into agent runs and ensure teach handling in the runner respects scope when appending lessons. Includes unit tests for runner teach behavior.

## Files to Modify
- src/runner/agentStateRunner.ts — replace readLearningsForPrompt with readMergedLearningsForPrompt
- src/runner/runner.ts — update handleTeach() to pass scope to appendUniqueLearning
- __tests__/unit/runner/runner.test.ts — add test for handleTeach respecting scope
- __tests__/unit/runner/agentStateRunner.test.ts — verify prompt includes merged learnings (mock readMergedLearningsForPrompt)

## Implementation Steps
1. Import the new readMergedLearningsForPrompt from src/context/learningStore.ts in agentStateRunner.ts and call it where prompts are assembled.
2. In src/runner/runner.ts's handleTeach(), when constructing appendUniqueLearning calls, pass entry.scope ?? 'global'. Add tests mocking appendUniqueLearning to assert scope passed.
3. Update unit tests to mock the learningStore functions so no disk I/O occurs; preserve existing test patterns (jest.mock('fs') or helpers).
4. Run unit tests for runner and agentStateRunner.

## Acceptance Criteria
- [ ] agentStateRunner uses readMergedLearningsForPrompt to include both global and workflow learnings
- [ ] runner.handleTeach passes scope correctly to appendUniqueLearning
- [ ] Unit tests assert scope forwarding and prompt merging

## Context from Parent
Relevant excerpts:
- "Replace readLearningsForPrompt(...) with readMergedLearningsForPrompt(...)" (line 50–51)
- "In handleTeach(), pass the `scope` from the teach entry (or default to 'global')" (lines 58–61)
