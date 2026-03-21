# RAI-32: Extract lessons from agent output using LESSON: markers

**Type:** improvement

## Description
Improve the learning system to separate general, reusable lessons from run-specific feedback by extracting only marked lesson content. When a `learn_from` source contains a lesson marker (`lesson:` or `LESSON:`), the system should extract and store only the section after the first marker. If there's markers after the first one, they're not considered markers any more. Only the first one matters. Any content without a lesson marker must be ignored and not stored.

This change keeps the learning store focused on actionable, reusable lessons (e.g., test-writing guidance, design notes) and prevents polluting the learnings with ephemeral run-specific details.

## Documentation References
- documentation/ (see learning or storage-related docs if present)

## Code References
- src/learningStore.ts (extractLessons, appendUniqueLearning)
- src/outputStore.ts (if output persistence interacts with learning storage)
- src/engine/AgentStateRunner.ts (places where learn_from sources are assembled)
- src/registryValidator.ts (only if registry affects learning inputs)

## Acceptance Criteria
- [x] extractLessons(content: string) exists in src/learningStore.ts and returns an array of individual lesson strings extracted from the input.
- [x] appendUniqueLearning() is updated to call extractLessons and append each lesson individually; unmarked content is not persisted.
- [x] Unit tests added under __tests__/unit for extractLessons covering: single marker, multiple markers, no markers (returns empty array), case variations (`lesson:`/`LESSON:`), surrounding whitespace, and multiline lesson bodies.
- [x] Integration test added under __tests__/integration that simulates an agent output containing `LESSON:` and verifies that the lesson is stored at `.raili/<workflow>/learnings/<agentId>.md` and that unmarked text is not stored.
- [x] Multiline lessons preserve internal newlines and whitespace when stored.
- [ ] All tests pass (npm test) and code compiles.

Notes: Implemented extractLessons, updated appendUniqueLearning, added unit and integration tests. Marking items implemented; test/build verification pending.
