# RAI-74 — Part 3: CLI, schema, and workflow validation

**Parent ticket:** RAI-74 (RAI-74-feature-make-learnings-global-by-default.md)

## Scope
Add scope option to teach CLI, update workflow schema to accept scope on teach entries, and validate scope values during workflow loading.

## Files to Modify
- src/cli/teach.ts — add --scope flag and pass scope to appendManualLearning
- src/workflow/schemas.ts — add optional scope enum ['global','workflow'] to teach source entries
- src/workflow/workflowLoader.ts — validate teach scope values and fail-fast on invalid values
- __tests__/unit/cli/teach.test.ts — test CLI flag behavior

## Implementation Steps
1. Add a `--scope` option to src/cli/teach.ts (default 'global'); parse and pass value to appendManualLearning.
2. Modify src/workflow/schemas.ts teach schema so each source entry allows optional `scope: 'global'|'workflow'` with description and default documented.
3. In src/workflow/workflowLoader.ts, augment validation so any teach entry with scope is validated against allowed values and throws descriptive error if invalid.
4. Add unit tests ensuring CLI flag results in correct appendManualLearning calls and schema validation rejects bad values.

## Acceptance Criteria
- [ ] `raili teach` supports `--scope global|workflow` and defaults to global
- [ ] teach schema accepts scope and workflowLoader rejects invalid values
- [ ] Unit tests cover CLI and schema validation

## Context from Parent
Relevant excerpts:
- "Add optional `scope: workflow` to keep lessons local" (line 12)
- "Update teach schema to include scope" (lines 63–73)
- "In `handleTeach()` method, pass the `scope` from the teach entry (or default to 'global')" (lines 58–61)
