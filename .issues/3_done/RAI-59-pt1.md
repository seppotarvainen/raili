# RAI-59 — Part 1: Types, schema, and docs

**Parent ticket:** RAI-59 (RAI-59-improvement-multiple-stored-outputs.md)

## Scope
Add the new optional OutputConfig.use_latest TypeScript field and its workflow schema entry. Update documentation to describe semantics and examples. This part provides foundational artifacts other parts depend on.

## Files to Modify
- src/types.ts — add `use_latest?: number` to OutputConfig
- src/workflow/schemas.ts — add `use_latest` entry to OutputConfigSchema
- documentation/output.md — document the new `use_latest` option and examples

## Implementation Steps
1. Edit `src/types.ts` to add `use_latest?: number` on OutputConfig with a short JSDoc explaining semantics (number > 0). Keep optional and backward compatible.
2. Edit `src/workflow/schemas.ts` to add `use_latest` to the OutputConfigSchema (type: number, minimum: 1, description: "Number of latest runs to inject (omit to use all)").
3. Add examples to `documentation/output.md` showing omitted (all runs), `use_latest: 5`, and `use_latest: 1` behavior. Include note about interaction with marker/tail.
4. Run `npm test` locally (unit tests will be updated in later parts). Ensure types compile.

## Acceptance Criteria
- [x] `OutputConfig` TypeScript interface includes optional `use_latest?: number`
- [x] `OutputConfigSchema` in `schemas.ts` includes `use_latest` field with minimum 1
- [x] Documentation updated with examples and semantics

## Context from Parent
From parent ticket:
"Add optional `use_latest` field to `OutputConfig` that allows users to control how many stored output runs to inject. The default behavior (when `use_latest` is omitted) is to inject all stored outputs."

Example (from parent):
```yaml
my_agent:
  type: agent
  agent: some-agent
  prompt: "Continue analysis"
  output:
    store: true
    use_latest: 5
    tail: 100
  continue: next_step
```