# RAI-57 — Part 3: Refactor registry & workflow loader unit tests

**Parent ticket:** RAI-57 (RAI-57-chore-restrict-infrastructure-unit-tests.md)

## Scope
Refactor registry and workflow loader unit tests to use the in-memory filesystem, removing any real fs usage and ensuring fail-fast validation still behaves as expected.

## Files to Modify
- __tests__/unit/registry/agentRegistry.test.ts — use fake fs
- __tests__/unit/registry/scriptRegistry.test.ts — use fake fs
- __tests__/unit/registry/registryValidator.test.ts — use fake fs
- __tests__/unit/workflow/workflowLoader.test.ts — use fake fs
- __tests__/unit/workflow/workflowLoader.workflowFlag.test.ts — use fake fs
- __tests__/unit/workflow/workflowLoader.inputs.test.ts — use fake fs

## Implementation Steps
1. Add setupFakeFs usage to each test file; remove direct fs imports.
2. Create necessary registry and workflow files in the fake fs before exercising loaders/validators.
3. Ensure registry-validator still throws on missing files (fail-fast) — simulate missing files in fake FS tests.
4. Adjust tests that rely on os.tmpdir or mkdtempSync to use deterministic fake paths.
5. Run tests and iterate until green.

## Acceptance Criteria
- [ ] Registry and workflow loader tests run using the fake filesystem and no real files are created
- [ ] Fail-fast behavior validated in tests remains correct

## Context from Parent
Ticket notes these files specifically in the refactor list and emphasizes validation of registry references via registryValidator.ts. The fake FS must be able to simulate missing files to allow negative tests.
