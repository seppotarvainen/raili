# RAI-76 — Part 1: Parser & Workflow Document Model

**Parent ticket:** RAI-76 (RAI-76-lsp-language-server.md)

## Scope
Implement the lightweight parser and WorkflowDocument model that extracts state definitions, references, and position mapping from a single workflow.yaml file. Provide unit tests and utilities that later protocol/validator code will consume.

## Files to Modify
- packages/lsp/src/parser/workflowParser.ts — implement parser that emits definitions & references with line/column
- packages/lsp/src/types.ts — WorkflowDocument, StateDef, StateRef types
- packages/lsp/src/model/workflowDocument.ts — in-memory document model + helpers
- packages/lsp/__tests__/parser.test.ts — unit tests for parsing positions and reference extraction
- packages/lsp/__tests__/model.test.ts — unit tests for model helpers

## Implementation Steps
1. Create types for StateDef (name, type, location) and StateRef (name, location, context).
2. Implement workflowParser.ts that uses js-yaml to parse and a position mapper to record line/column for keys.
3. Build WorkflowDocument model that exposes states(), stateReferences(), and a positionMap.
4. Write unit tests with sample workflow.yaml snippets to assert definitions + references + positions.
5. Run `npm run test:lsp` and fix issues until parser tests pass.

## Acceptance Criteria
- [ ] Parser returns state definitions with correct line/column
- [ ] Parser extracts all routing references (on, transitions, approval, continue, skip)
- [ ] WorkflowDocument exposes stateReferences() and states() API
- [ ] Unit tests cover edge cases: duplicate IDs, nested maps, missing initial

## Context from Parent
From Design/Parser Strategy:

- "Track state definitions (name, line, column, type)"
- "Track state references (name, line, column, context: `on`/`transitions`/`approval`/etc.)"
- "Build a position map during parse: `Map<line:column, {type: 'def'|'ref', name, context}>`"

(See RAI-76-lsp-language-server.md lines ~229-236, 295-303)
