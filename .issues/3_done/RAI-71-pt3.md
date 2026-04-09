# RAI-71 — Part 3: HTML wrapper and visual command core

**Parent ticket:** RAI-71 (RAI-71-feature-add-visual-command.md)

## Scope
Provide HTML wrapper to embed Mermaid syntax and implement the core visualCommand(cwd, workflowArg, format, outPath) that loads workflow, builds graph (Part 1), renders Mermaid (Part 2), and writes output. Includes unit tests for HTML wrapper and basic output behavior.

## Files to Modify
- src/cli/htmlWrapper.ts — new file: wrapMermaidInHtml(mermaidSyntax: string): string
- src/cli/visual.ts — new file: visualCommand(...) calling loadWorkflowConfig, registry validation, buildGraph, renderMermaid, and write output
- __tests__/unit/htmlWrapper.test.ts — unit tests for HTML wrapper
- __tests__/unit/visualCommand.test.ts — basic unit tests mocking loadWorkflowConfig and verifying file/stdout outputs (can be lightweight)

## Implementation Steps
1. Implement wrapMermaidInHtml that returns a minimal HTML doc embedding Mermaid via CDN and includes the mermaid syntax inside a `<pre class="mermaid">` or script initializer.
2. Implement visualCommand(cwd, workflowArg='main', format='mermaid', outPath?)
   - Call loadWorkflowConfig(cwd, workflowArg) to get WorkflowConfig
   - (Fail-fast) Load and validate agent/script registries exist (use existing registry loaders) and ensure referenced agents/scripts exist — throw if not
   - Use buildGraph(config) from Part 1
   - Use renderMermaid(graph) from Part 2
   - If outPath is '-' print mermaid syntax to stdout
   - If outPath endsWith '.mmd' write raw mermaid syntax
   - Otherwise wrap with HTML and write .html file
   - Default outPath: `.raili/<workflow>/diagram.html` (ensure directories exist)
3. Add unit tests for htmlWrapper and a small visualCommand test that stubs dependencies and asserts writing behavior.

## Acceptance Criteria
- [ ] wrapMermaidInHtml returns valid HTML containing Mermaid CDN reference and the syntax
- [ ] visualCommand composes load → buildGraph → renderMermaid → write behavior
- [ ] visualCommand supports `--out -` to stdout
- [ ] Unit tests for wrapper and core logic present

## Context from Parent
Relevant plan excerpts:
- "wrapMermaidInHtml(mermaidSyntax: string): string"
- "visualCommand loads workflow, validates registries, builds graph, calls renderMermaid, writes output to .raili/<workflow>/diagram.html or stdout"