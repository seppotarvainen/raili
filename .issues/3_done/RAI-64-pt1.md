# RAI-64 — Part 1: Extract template helper functions

**Parent ticket:** RAI-64 (RAI-64-feature-add-create-command.md)

## Scope
Extract reusable template-generation helpers from src/init.ts and expose them for use by the new `raili create` command. Add unit tests for these helpers and any small type updates needed.

## Files to Modify
- src/init.ts — extract template logic into named functions and export them
- src/types.ts — add or refine any small types (e.g., CreateTemplateResult) if needed
- src/infrastructure/fileSystemProvider.ts — ensure helper-friendly API for writing template files (minor tweaks only)
- __tests__/unit/init_helpers.test.ts — new unit tests for generated templates

## Implementation Steps
1. Add exported functions in src/init.ts:
   - `generateWorkflowYaml(workflowName?: string): string`
   - `generateAgentRegistry(): object`
   - `generateScriptRegistry(): object`
2. Move the existing inline template content into these helpers, preserving comments and header (`# Raili Workflow Configuration`).
3. Export these helpers from src/init.ts and update any internal callers to import them.
4. Add unit tests in __tests__/unit/init_helpers.test.ts to assert expected strings/objects are returned (check header text and that agent/script registries are objects with expected keys).
5. If needed, add small type definitions to src/types.ts and export them.
6. Run unit tests and ensure no regressions.

## Acceptance Criteria
- [ ] generateWorkflowYaml, generateAgentRegistry, generateScriptRegistry are implemented and exported from src/init.ts
- [ ] Unit tests covering helpers exist and pass
- [ ] Other code that depended on inline templates is updated to import these helpers
- [ ] No unrelated behavior changed

## Context from Parent
(From parent ticket: Implementation Plan step 3)

> 3. **src/init.ts** — Extract template generation logic (workflow.yaml content, agent-registry.json, script-registry.json) into standalone, reusable helper functions:
>    - `generateWorkflowYaml(): string` — Returns the template workflow.yaml content
>    - `generateAgentRegistry(): object` — Returns the default agent registry
>    - `generateScriptRegistry(): object` — Returns the default script registry

Include template content and header expectations per the parent ticket's Test Plan (workflow.yaml starts with `# Raili Workflow Configuration`).
