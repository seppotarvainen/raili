# RAI-74 — Part 1: Core learnings storage and types

**Parent ticket:** RAI-74 (RAI-74-feature-make-learnings-global-by-default.md)

## Scope
Implement foundational changes: add scope-aware learnings file resolution and core merged-read APIs and type updates. This part enables subsequent parts to consume merged/global/workflow learnings.

## Files to Modify
- src/types.ts — add optional scope to LearnSource and related JSDoc
- src/context/pathUtils.ts — add optional scope parameter to learningsFilePath()
- src/context/learningStore.ts — implement readMergedLearnings(), readMergedLearningsForPrompt(), and update signatures for appendUniqueLearning()/appendManualLearning()
- __tests__/unit/context/learningStore.unit.setup.ts — helper setup for learningStore tests (if needed)

## Implementation Steps
1. Update src/types.ts: add scope?: 'global' | 'workflow' to LearnSource and document default = 'global'.
2. Update src/context/pathUtils.ts: change learningsFilePath(cwd, agentId, workflow?, scope = 'global') → resolves to `.raili/learnings/<agentId>.md` for global, `.raili/<workflow>/learnings/<agentId>.md` for workflow. Add JSDoc.
3. In src/context/learningStore.ts:
   - Add exported readMergedLearnings(cwd, agentId, workflowArg?) that reads both global and workflow files and merges (workflow wins, dedupe normalized content).
   - Add readMergedLearningsForPrompt(cwd, agentId, workflowArg?) returning prompt-ready string (timestamps removed).
   - Update existing readLearnings/readLearningsForPrompt signatures to accept scope param but keep backward-compatible overloads.
   - Update appendUniqueLearning/appendManualLearning signatures to accept scope (default 'global') and ensure write path uses pathUtils.
4. Add lightweight unit-helper file to create .raili dirs for tests (if repository lacks one).
5. Run unit tests for compilation (local verification step).

## Acceptance Criteria
- [x] types.ts updated and compiles
- [x] pathUtils.learningsFilePath supports scope and resolves correct paths
- [x] readMergedLearnings and readMergedLearningsForPrompt implemented and exported
- [x] appendUniqueLearning/appendManualLearning accept scope param (default 'global')
- [x] Unit helper exists to create .raili dirs for tests

## Context from Parent
Relevant excerpts:
- "Learnings default to global scope (`.raili/learnings/<agent_id>.md`)" (lines 10–13)
- "readMergedLearnings(cwd, agentId, workflowArg?)" concept (lines 40–45)
- Files referenced: src/context/pathUtils.ts, src/context/learningStore.ts, src/types.ts (lines 20–25, 31–47, 53–56)
