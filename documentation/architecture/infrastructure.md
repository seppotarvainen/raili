# Infrastructure: File System Provider

This document describes the IFileSystem abstraction and the file system provider used across the Raili codebase.

Overview
- src/fileSystem.ts exports the `IFileSystem` interface and a `NodeFileSystem` implementation that forwards to Node's `fs` module.
- src/fileSystemProvider.ts exports `getFileSystem()` and `setFileSystem()` to obtain or replace the current filesystem implementation.

Why
- Centralizing filesystem access enables easy test doubles in unit tests and prevents modules from importing `fs` directly.
- Integration tests can still use real filesystem since the default provider is NodeFileSystem.

How to use
- Production code:
  // In TypeScript source (example import path relative to your file)
  import { getFileSystem } from './fileSystemProvider';
  const fs = getFileSystem();
  if (fs.existsSync(path)) { ... }

- Unit tests (mock provider):
  import { IFileSystem } from '../../src/fileSystem';
  const mockFs: IFileSystem = {
    existsSync: jest.fn().mockReturnValue(true),
    readFileSync: jest.fn().mockReturnValue('{"stateHistory":[]}'),
    // implement other methods as needed by the test
  };
  jest.mock('../../src/fileSystemProvider', () => ({ getFileSystem: () => mockFs }));

Notes
- Keep the interface small and add methods only when needed.
- Do not mock Node's `fs` globally in unit tests; prefer mocking the provider instead.
