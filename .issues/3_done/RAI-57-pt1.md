# RAI-57 — Part 1: In-memory filesystem utility

**Parent ticket:** RAI-57 (RAI-57-chore-restrict-infrastructure-unit-tests.md)

## Scope
Implement a production-quality in-memory filesystem that implements IFileSystem and a test helper to inject it into unit tests. This is foundational work other refactors will depend on.

## Files to Modify
- __tests__/unit/infrastructure/fsFake.util.ts — new: InMemoryFileSystem + setupFakeFs()
- __tests__/unit/infrastructure/fsFake.util.test.ts — new: unit tests for the fake FS implementation

## Implementation Steps
1. Create InMemoryFileSystem class implementing all IFileSystem methods used by unit tests: existsSync, readFileSync, writeFileSync, appendFileSync, mkdirSync, unlinkSync, rmSync, chmodSync, statSync, readdirSync.
2. Simulate fs.Stats for statSync and ensure path normalization.
3. Implement setupFakeFs(): save original provider, set fake via setFileSystem(fake), return restore function.
4. Add unit tests verifying write/read/append, mkdir recursive, unlink/rm behavior, ENOENT errors, and setupFakeFs restore semantics.
5. Run unit tests for the new util and iterate until passing.

## Acceptance Criteria
- [ ] __tests__/unit/infrastructure/fsFake.util.ts exists and implements IFileSystem
- [ ] setupFakeFs() injects and restores filesystem provider
- [ ] fsFake.util tests cover core behaviors and pass

## Context from Parent
From parent ticket:
"Unit tests in __tests__/unit/** currently import and use Node's fs module directly... Create an in-memory filesystem fake (__tests__/unit/fsFake.util.ts) that implements IFileSystem and can be injected via setFileSystem()."

Example sketch (adapted):
```ts
export class InMemoryFileSystem implements IFileSystem {
  private files: Map<string, string | Buffer> = new Map();
  private dirs: Set<string> = new Set();
  // implement methods: existsSync, readFileSync, writeFileSync, appendFileSync, mkdirSync, unlinkSync, rmSync, chmodSync, statSync, readdirSync
}

export function setupFakeFs(): () => void {
  const originalFs = getFileSystem();
  const fakeFs = new InMemoryFileSystem();
  setFileSystem(fakeFs);
  return () => setFileSystem(originalFs);
}
```
