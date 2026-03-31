# RAI-57 — Part 4: Refactor handlers and variables unit tests

**Parent ticket:** RAI-57 (RAI-57-chore-restrict-infrastructure-unit-tests.md)

## Scope
Refactor handler-related and variable-loader unit tests to use the in-memory filesystem. Ensure handler tests that create temporary agent/script files use the fake FS and that variable loader error cases are preserved.

## Files to Modify
- __tests__/unit/handlers/agentHandler.test.ts — replace real fs with fake
- __tests__/unit/handlers/scriptHandler.test.ts — replace real fs with fake
- __tests__/unit/variables/varsFile.test.ts — replace real fs with fake
- __tests__/unit/variables/varsLoader.errors.test.ts — replace real fs with fake

## Implementation Steps
1. Add setupFakeFs in each test file and remove fs imports.
2. Use getFileSystem() to create agent/script files and registry files in the fake FS before invoking handlers.
3. Ensure frontmatter parsing / model overrides behave identically with files read from fake FS.
4. Preserve negative test cases by simulating missing or malformed files in fake FS.
5. Run the handler and variable tests and fix any path/stat inconsistencies.

## Acceptance Criteria
- [ ] Handler and variable tests run with the fake filesystem
- [ ] All behavior (including error cases) remains unchanged

## Context from Parent
Parent ticket lists agentHandler.test and scriptHandler.test as files to refactor and notes that agent file frontmatter/model parsing must still work when files are supplied by the fake filesystem.
