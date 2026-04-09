# RAI-71 — Part 1: Graph types & builder

**Parent ticket:** RAI-71 (RAI-71-feature-add-visual-command.md)

## Scope
Provide the graph data model and a deterministic builder that converts a WorkflowConfig into a typed Graph (nodes, edges, terminal set). Includes validation (undefined transition targets) and unit tests.

## Files to Modify
- src/cli/graphBuilder.ts — new file: Graph types and buildGraph(config)
- src/types.ts — export or add Graph-related types/interfaces used by other parts
- __tests__/unit/graphBuilder.test.ts — unit tests for buildGraph

## Implementation Steps
1. Add GraphNode, GraphEdge, Graph interfaces (can live in src/cli/graphBuilder.ts or exported types in src/types.ts). Ensure minimal coupling: use existing StateType and StateConfig from src/types.ts.
2. Implement buildGraph(config: WorkflowConfig): Graph
   - Create nodes for each state with id, type, config
   - Identify terminal states (states without on/transitions/approval)
   - Extract edges from `on` (PASSED/FAILED) and `transitions` (named keys)
   - Mark default transitions if `default` or `transitions` contains a `default` key
   - Validate that every edge.to exists in states; throw error listing missing states
3. Add unit tests in __tests__/unit/graphBuilder.test.ts covering:
   - nodes creation
   - edge extraction for `transitions` and `on`
   - terminal detection
   - throwing on undefined transition target
4. Keep code small, synchronous, and deterministic to satisfy testing patterns in repo.

## Acceptance Criteria
- [x] buildGraph accepts a WorkflowConfig and returns Graph with nodes, edges, terminal set
- [x] buildGraph throws on undefined transition targets
- [x] Unit tests cover node, edge, terminal, and error cases

## Context from Parent
Copy of relevant implementation plan sections:
- "Define GraphNode/GraphEdge/Graph interfaces and export buildGraph(config: WorkflowConfig)"
- "Create nodes for each state (id, type, config)"
- "Extract edges from `on:` and `transitions:` and validate targets exist"
