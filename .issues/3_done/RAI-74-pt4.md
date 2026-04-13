# RAI-74 — Part 4: Unit tests for learningStore and types

**Parent ticket:** RAI-74 (RAI-74-feature-make-learnings-global-by-default.md)

## Scope
Add unit tests focused on learningStore merging/deduplication and type validations for the new scope field.

## Files to Modify / Create
- __tests__/unit/context/learningStore.test.ts — tests for readMergedLearnings(), readMergedLearningsForPrompt(), appendUniqueLearning scope behavior
- __tests__/unit/types/teach.test.ts — compile/type check tests ensuring LearnSource accepts optional scope
- test helpers if needed under __tests__/unit/helpers/

## Implementation Steps
1. Create unit tests that set up temporary .raili/learnings and .raili/<workflow>/learnings files and assert readMergedLearnings merges and dedupes correctly.
2. Test readMergedLearningsForPrompt returns prompt-ready text with timestamps stripped.
3. Test appendUniqueLearning writes to correct path depending on scope param by mocking filesystem or using test workspace helpers.
4. Add small type-level test ensuring optional scope in LearnSource does not break compilation (TS compile step in tests).

## Acceptance Criteria
- [ ] Unit tests for merging/deduplication pass
- [ ] Tests verify appendUniqueLearning scope routing
- [ ] Type test passes (TS compilation)

## Context from Parent
Relevant excerpts:
- Unit test suggestions (lines 169–198, 185–198)
- "readMergedLearnings() merges global and workflow learnings" (line 171)
- "appendUniqueLearning() with scope='global' writes to root learnings" (lines 190–196)
