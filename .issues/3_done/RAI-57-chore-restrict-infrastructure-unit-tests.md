# RAI-57: Restrict infrastructure use from unit tests

**Type:** chore

## Description

Unit tests in `__tests__/unit/**` currently import and use Node's `fs` module directly to create temporary directories and files. This violates the principle of test isolation—tests should not create real files on disk. The infrastructure provider (`src/infrastructure/fileSystemProvider.ts`) already abstracts filesystem operations with an `IFileSystem` interface and a global provider pattern, but unit tests bypass this abstraction by directly importing `fs`.

This ticket creates an in-memory filesystem fake (`__tests__/unit/fsFake.util.ts`) that implements `IFileSystem` and can be injected via `setFileSystem()`. Unit tests will be refactored to use this fake instead of real filesystem operations, ensuring tests are isolated, deterministic, and faster.

## Documentation References

- documentation/infrastructure.md

## Code References

- src/infrastructure/fileSystemProvider.ts (getFileSystem, setFileSystem)
- src/infrastructure/fileSystem.ts (IFileSystem interface)
- __tests__/unit/** (all unit test files using fs import)

## Implementation Plan

1. **Create `__tests__/unit/fsFake.util.ts`** — Implement an in-memory filesystem that implements `IFileSystem` interface. Track files/directories in memory using a Map structure. Implement all required methods: `existsSync`, `readFileSync`, `writeFileSync`, `appendFileSync`, `mkdirSync`, `unlinkSync`, `rmSync`, `chmodSync`, `statSync`, `readdirSync`. Simulate `fs.Stats` objects for `statSync`.

2. **Refactor unit tests to use the fake filesystem**:
   - **`__tests__/unit/context/context.test.ts`** — Replace `fs.mkdtempSync()`, `fs.mkdirSync()`, `fs.rmSync()`, `fs.writeFileSync()`, `fs.readFileSync()` with in-memory fake. Remove `tmpdir` and `railiDir` setup, inject fake fs via `setFileSystem()` in `beforeEach()`, restore in `afterEach()`.
   - **`__tests__/unit/context/outputStore.*.test.ts`** (resolvePath, flattened, latestRun) — Replace real fs calls with fake.
   - **`__tests__/unit/context/learningStore.*.test.ts`** (learningStore, flattened) — Replace real fs calls with fake.
   - **`__tests__/unit/context/agentOutputStore.test.ts`** — Replace real fs calls with fake.
   - **`__tests__/unit/registry/agentRegistry.test.ts`** — Replace fs.mkdtempSync, mkdirSync, writeFileSync with fake.
   - **`__tests__/unit/registry/scriptRegistry.test.ts`** — Replace real fs calls with fake.
   - **`__tests__/unit/registry/registryValidator.test.ts`** — Replace real fs calls with fake.
   - **`__tests__/unit/workflow/workflowLoader.test.ts`** — Replace real fs calls with fake.
   - **`__tests__/unit/workflow/workflowLoader.workflowFlag.test.ts`** — Replace real fs calls with fake.
   - **`__tests__/unit/workflow/workflowLoader.inputs.test.ts`** — Replace real fs calls with fake.
   - **`__tests__/unit/handlers/agentHandler.test.ts`** — Replace fs.mkdtempSync, mkdirSync, writeFileSync with fake.
   - **`__tests__/unit/handlers/scriptHandler.test.ts`** — Replace real fs calls with fake.
   - **`__tests__/unit/variables/varsFile.test.ts`** — Replace real fs calls with fake.
   - **`__tests__/unit/variables/varsLoader.errors.test.ts`** — Replace real fs calls with fake.
   - **`__tests__/unit/run.test.ts`** — Replace real fs calls with fake.
   - **`__tests__/unit/run.skip.test.ts`** — Replace real fs calls with fake.
   - **`__tests__/unit/run.workflowFlag.test.ts`** — Replace real fs calls with fake.
   - **`__tests__/unit/cli/cli.collectVars.test.ts`** — Replace real fs calls with fake.
   - **`__tests__/unit/cli/cli.stats.test.ts`** — Replace real fs calls with fake.
   - **`__tests__/unit/init.test.ts`** — Replace real fs calls with fake.

3. **Export `setupFakeFs` utility from fsFake.util.ts** — Create a helper function that:
   - Creates a new `InMemoryFileSystem` instance
   - Calls `setFileSystem(fs)` to inject it
   - Returns a restore function that resets to the original provider
   - This simplifies test setup: `const restore = setupFakeFs(); afterEach(() => restore());`

4. **Update all affected unit tests** — In each test file:
   - Remove `import fs from 'fs'` or `import * as fs from 'fs'`
   - Add `import { setupFakeFs } from '../infrastructure/fsFake.util'` (adjust path as needed)
   - In `beforeEach()`, call `const restoreFs = setupFakeFs()`
   - In `afterEach()`, call `restoreFs()`
   - Replace all real fs calls with paths/operations on the fake fs (they work transparently via `getFileSystem()`)
   - Remove temp directory cleanup logic (no real files to clean)

5. **Verify no direct fs imports remain in unit tests** — Run `grep -r "import.*fs" __tests__/unit/` after refactoring to ensure no direct fs imports exist.

## Examples

### In-memory file system implementation (sketch)

```typescript
// __tests__/unit/fsFake.util.ts
export class InMemoryFileSystem implements IFileSystem {
  private files: Map<string, string | Buffer> = new Map();
  private dirs: Set<string> = new Set();

  existsSync(path: string): boolean {
    return this.files.has(path) || this.dirs.has(path);
  }

  readFileSync(path: string, enc: string = 'utf8'): string {
    if (!this.files.has(path)) throw new Error(`ENOENT: no such file or directory: ${path}`);
    const data = this.files.get(path);
    return typeof data === 'string' ? data : data.toString(enc);
  }

  writeFileSync(path: string, data: string | Buffer, enc?: string): void {
    this.ensureDir(dirname(path));
    this.files.set(path, data);
  }

  mkdirSync(path: string, opts?: fs.MakeDirectoryOptions | number): void {
    if (this.dirs.has(path)) return;
    const recursive = typeof opts === 'object' ? opts.recursive : false;
    if (recursive) {
      const parts = path.split('/');
      let curr = '';
      for (const part of parts) {
        curr = curr ? `${curr}/${part}` : part;
        this.dirs.add(curr);
      }
    } else {
      this.dirs.add(path);
    }
  }

  // ... implement other methods similarly
}

export function setupFakeFs(): () => void {
  const originalFs = getFileSystem();
  const fakeFs = new InMemoryFileSystem();
  setFileSystem(fakeFs);
  return () => setFileSystem(originalFs);
}
```

### Before: unit test using real fs

```typescript
import fs from 'fs';
import os from 'os';
import path from 'path';
import { loadContext } from '../../../src/context/context';

describe('context', () => {
  let tmpdir: string;

  beforeEach(() => {
    tmpdir = fs.mkdtempSync(path.join(os.tmpdir(), 'raili-ctx-test-'));
    fs.mkdirSync(path.join(tmpdir, '.raili', 'main'), { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tmpdir, { recursive: true, force: true });
  });

  test('loads existing context from file', () => {
    const railiDir = path.join(tmpdir, '.raili', 'main');
    fs.writeFileSync(path.join(railiDir, 'context.json'), '{"stateHistory":[]}');
    const ctx = loadContext(tmpdir);
    expect(ctx.stateHistory).toEqual([]);
  });
});
```

### After: unit test using fake fs

```typescript
import path from 'path';
import { setupFakeFs } from '../infrastructure/fsFake.util';
import { loadContext } from '../../../src/context/context';
import { getFileSystem } from '../../../src/infrastructure/fileSystemProvider';

describe('context', () => {
  let restoreFs: () => void;
  const tmpdir = '/tmp/test-workspace';

  beforeEach(() => {
    restoreFs = setupFakeFs();
    const fs = getFileSystem();
    fs.mkdirSync(path.join(tmpdir, '.raili', 'main'), { recursive: true });
  });

  afterEach(() => {
    restoreFs();
  });

  test('loads existing context from file', () => {
    const fs = getFileSystem();
    const railiDir = path.join(tmpdir, '.raili', 'main');
    fs.writeFileSync(path.join(railiDir, 'context.json'), '{"stateHistory":[]}');
    const ctx = loadContext(tmpdir);
    expect(ctx.stateHistory).toEqual([]);
  });
});
```

## Test Plan

### Unit tests (`__tests__/unit/`)

- **File:** `__tests__/unit/infrastructure/fsFake.util.test.ts`
- **Test case:** "InMemoryFileSystem stores and retrieves files"
  - Setup: Create InMemoryFileSystem, write a file
  - Act: Read the file back
  - Assert: Content matches what was written

- **Test case:** "InMemoryFileSystem throws ENOENT on missing files"
  - Setup: Create InMemoryFileSystem
  - Act: Try to read a file that doesn't exist
  - Assert: Throws error with ENOENT

- **Test case:** "InMemoryFileSystem supports recursive mkdir"
  - Setup: Create InMemoryFileSystem
  - Act: Call mkdirSync with recursive: true on nested path
  - Assert: All parent directories are created

- **Test case:** "InMemoryFileSystem supports append and write"
  - Setup: Create InMemoryFileSystem
  - Act: Write file, then append more data
  - Assert: Final content contains original + appended data

- **Test case:** "InMemoryFileSystem supports unlinkSync and rmSync"
  - Setup: Create InMemoryFileSystem, create files and dirs
  - Act: Delete file, delete directory tree
  - Assert: Files/dirs no longer exist

- **Test case:** "setupFakeFs injects fake fs and restores original"
  - Setup: Call setupFakeFs()
  - Act: Verify getFileSystem() returns InMemoryFileSystem, call restore
  - Assert: After restore, getFileSystem() returns NodeFileSystem

### Integration tests for refactored unit tests

- **File:** Existing unit test files (e.g., `__tests__/unit/context/context.test.ts`)
- **Test case:** "Refactored test passes with fake fs instead of real fs"
  - Verify that all existing test cases in refactored files continue to pass
  - No real files are created on disk during test execution
  - Test isolation is preserved (each test gets a clean fake fs)

## Acceptance Criteria

- [ ] `__tests__/unit/fsFake.util.ts` implements `IFileSystem` with in-memory storage (no real fs operations)
- [ ] All methods from `IFileSystem` are implemented: `existsSync`, `readFileSync`, `writeFileSync`, `appendFileSync`, `mkdirSync`, `unlinkSync`, `rmSync`, `chmodSync`, `statSync`, `readdirSync`
- [ ] `setupFakeFs()` utility function injects fake fs and returns a restore function
- [ ] All 23 unit test files that currently import `fs` have been refactored to use the fake fs
- [ ] No unit test files import `fs` directly (verified with `grep`)
- [ ] No real files are created in system temp directories during `npm test` (unit tests only)
- [ ] All unit tests pass with fake fs (`npm test`)
- [ ] Integration tests continue to use real filesystem (unaffected)
- [ ] Unit test performance improves (no real I/O)
