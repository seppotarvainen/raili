# RAI-57 — Part 2: Refactor context-related unit tests to use fake FS

**Parent ticket:** RAI-57 (RAI-57-chore-restrict-infrastructure-unit-tests.md)

## Scope
Refactor context-area unit tests to use the InMemoryFileSystem and setupFakeFs helper so they no longer touch the real filesystem.

## Files to Modify
- __tests__/unit/context/context.test.ts — replace real fs with fake
- __tests__/unit/context/outputStore.flattened.test.ts — replace real fs with fake
- __tests__/unit/context/outputStore.latestRun.test.ts — replace real fs with fake
- __tests__/unit/context/learningStore.flattened.test.ts — replace real fs with fake
- __tests__/unit/context/agentOutputStore.test.ts — replace real fs with fake

## Implementation Steps
1. Import setupFakeFs from __tests__/unit/infrastructure/fsFake.util in each test file.
2. Remove direct imports of node's fs (import fs from 'fs') from those test files.
3. In beforeEach(), call const restoreFs = setupFakeFs(); and create any required directories/files via getFileSystem().
4. In afterEach(), call restoreFs().
5. Replace any tmpdir/os.tmpdir usage with deterministic paths (e.g., '/tmp/test-workspace').
6. Run tests and fix failing assertions caused by path differences or stat emulation.

## Acceptance Criteria
- [x] All listed context-related unit tests no longer import 'fs'
- [ ] Tests pass using the fake filesystem

## Context from Parent
Relevant plan items:
"Refactor unit tests to use the fake filesystem: __tests__/unit/context/context.test.ts, outputStore.*, learningStore.*, agentOutputStore.test" and instructions to use setupFakeFs() in beforeEach()/afterEach().
