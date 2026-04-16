# RAI-76 — Part 2: Protocol Handlers (definition, references, hover, diagnostics, rename)

**Parent ticket:** RAI-76 (RAI-76-lsp-language-server.md)

## Scope
Implement the protocol layer handlers that map LSP requests to WorkflowDocument queries: definition, references, hover, diagnostics, and rename. Include unit tests for each handler.

## Files to Modify
- packages/lsp/src/protocol/definition.ts — textDocument/definition handler
- packages/lsp/src/protocol/references.ts — textDocument/references handler
- packages/lsp/src/protocol/hover.ts — textDocument/hover handler
- packages/lsp/src/protocol/diagnostics.ts — publishDiagnostics implementation (uses validator)
- packages/lsp/src/protocol/rename.ts — textDocument/rename handler
- packages/lsp/__tests__/protocol.test.ts — tests for handlers

## Implementation Steps
1. Define handler interfaces that accept a WorkflowDocument and a position.
2. Implement definition.ts to resolve a reference to its state definition location.
3. Implement references.ts to return definition + all routing references.
4. Implement hover.ts to format state metadata into markdown using WorkflowDocument APIs.
5. Implement diagnostics.ts to call validator and return LSP Diagnostic objects.
6. Implement rename.ts to compute workspace/file edits limited to routing contexts.
7. Add unit tests that mock WorkflowDocument with sample docs and assert LSP outputs.

## Acceptance Criteria
- [x] Definition handler returns correct location for references
- [x] References handler returns definition + all usages
- [x] Hover shows state type, routing and key properties
- [x] Diagnostics maps validator output to LSP Diagnostic objects
- [x] Rename produces edits only in routing contexts, not arbitrary strings

## Context from Parent
From Core LSP Features and Hover structure:

- Goto Definition: jump to state declaration (textDocument/definition)
- Find References: list all usages including definition (textDocument/references)
- Hover: show state metadata (type, routing, properties)
- Diagnostics: undefined states, unreachable, unused, duplicate IDs, missing initial
- Rename: "Renames: state definition + all state references in routing contexts"

(See RAI-76-lsp-language-server.md lines ~59-106, 107-123, 85-96, 98-106)
