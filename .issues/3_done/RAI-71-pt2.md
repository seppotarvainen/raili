# RAI-71 — Part 2: Mermaid renderer

**Parent ticket:** RAI-71 (RAI-71-feature-add-visual-command.md)

## Scope
Implement the renderer that converts Graph (from Part 1) into Mermaid syntax. Includes node styling by state type, edge labels, dashed default edges, and annotations (max_visits, output.store). Provide unit tests.

## Files to Modify
- src/cli/mermaidRenderer.ts — new file: renderMermaid(graph: Graph): string
- __tests__/unit/mermaidRenderer.test.ts — unit tests for renderer

## Implementation Steps
1. Implement renderMermaid(graph: Graph): string producing a Mermaid `graph TD` string.
2. Map state types to visual shapes and colors (agent blue, script green, command orange, engine gray). Use simple text markers (emoji optional) and HTML-like labels for line breaks.
3. For terminal states use double-circle `(((id)))` syntax.
4. Emit edges with labels: `from -->|label| to`; if edge.isDefault use dashed `-.->` and label `default`.
5. Emit initial arrow: `[*] -->|initial| <initialState>`.
6. Append `style` lines for node colors and `Note over` annotations for max_visits & output.store.
7. Add unit tests verifying header, color styles, terminal notation, labeled edges, and dashed default edge.

## Acceptance Criteria
- [x] Output starts with `graph TD`
- [x] Nodes styled per state type and colors present as `style` lines
- [x] Terminal states rendered with `((( )))`
- [x] Edges labeled correctly and default edges dashed
- [x] Unit tests cover these behaviors

## Context from Parent
Relevant plan excerpt:
- "renderMermaid(graph: Graph): string"
- "Use `graph TD` direction; node styling by state type; terminal double-circle; edges labeled with outcome keys; default transitions dashed; initial arrow from `[*]`"
