# RAI-57 — Part 5: Refactor run/CLI/init unit tests

**Parent ticket:** RAI-57 (RAI-57-chore-restrict-infrastructure-unit-tests.md)

## Scope
Refactor the remaining unit tests that interact with the filesystem: run lifecycle tests, CLI tests that read/write files, and init tests that scaffold .raili. Ensure tests use the fake FS and maintain isolation.

## Files to Modify
- __tests__/unit/run.test.ts — replace real fs with fake
- __tests__/unit/run.skip.test.ts — replace real fs with fake
- __tests__/unit/run.workflowFlag.test.ts — replace real fs with fake
- __tests__/unit/cli/cli.collectVars.test.ts — replace real fs with fake
- __tests__/unit/cli/cli.stats.test.ts — replace real fs with fake
- __tests__/unit/init.test.ts — replace real fs with fake

## Implementation Steps
1. Add setupFakeFs usage to each test; remove direct fs imports.
2. For init tests, simulate project root and verify .raili scaffold created within fake FS.
3. For run/CLI tests, ensure environment vars and getFileSystem() usage is consistent with other refactors.
4. Run the full unit test suite and resolve any remaining real-fs usages.
5. Run grep to assert no unit test imports 'fs'.

## Acceptance Criteria
- [x] All listed run/CLI/init tests use the fake filesystem
- [x] No unit test imports 'fs' (verified by grep)
- [x] Running unit tests does not create real files on disk

## Context from Parent
Parent ticket lists run/test, CLI, and init tests among the files to refactor and includes a final acceptance criterion: "Verify no direct fs imports remain in unit tests — Run grep -r \"import.*fs\" __tests__/unit/".
