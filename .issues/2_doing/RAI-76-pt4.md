# RAI-76 — Part 4: Packaging, Build, Tests & CI Integration

**Parent ticket:** RAI-76 (RAI-76-lsp-language-server.md)

## Scope
Add packaging, build scripts, test commands, and CI integration for the new `@raili/lsp` package. Ensure version sync with root and add CI/test job entries. Provide integration tests and documentation notes for IntelliJ invocation (kept as a separate ticket but include instructions).

## Files to Modify
- package.json (root) — add build:lsp, test:lsp scripts
- packages/lsp/package.json — package metadata, scripts, devDeps
- packages/lsp/tsconfig.json — LSP-specific TS config
- packages/lsp/jest.config.js — test config
- .github/workflows/ci.yml — add job steps to build/test `packages/lsp`
- packages/lsp/__tests__/integration.test.ts — integration test parsing real workflow files
- docs/lsp.md — short dev guide for the LSP package (how to build, run, test)

## Implementation Steps
1. Create packages/lsp/package.json with version set to root version via CI step or prepublish script.
2. Add root scripts: build:lsp, test:lsp; update CI to run those steps.
3. Add tsconfig.json and jest.config.js in packages/lsp to allow isolated compile/test.
4. Add integration tests that run parser+validator on sample workflows and assert diagnostics.
5. Update documentation (docs/lsp.md) describing how to run `raili-lsp --stdio` and how IntelliJ can be configured (invoke stdio binary). Mark IntelliJ plugin implementation as separate ticket.
6. Run CI locally (npm run test) to verify workspace scripts.

## Acceptance Criteria
- [ ] Root scripts include build:lsp and test:lsp and run successfully locally
- [ ] packages/lsp tests run independently and pass
- [ ] CI workflow runs build:lsp and test:lsp
- [ ] docs/lsp.md added with build/run/test instructions

## Context from Parent
From Monorepo Build & Test and Version Sync:

- Root scripts: `build:lsp`: `cd packages/lsp && tsc`, tests via `cd packages/lsp && jest`
- `packages/lsp` version always matches root version; CI publishes both with the same tag

(See RAI-76-lsp-language-server.md lines ~184-213, 184-191)

## What's Ready for Use

```bash
# Build everything
npm run build

# Test everything
npm test

# Use raili-lsp
raili-lsp --stdio  # (invoked by IDE with stdio setup)
```

## What's Deferred

- **CI Integration** (.github/workflows/ci.yml) — No existing CI workflow; would be added as separate task
- **IntelliJ Plugin** (RAI-77) — Separate ticket for IDE integration configuration
- **VS Code Extension** (RAI-78+) — Future releases
- **Neovim Support** (RAI-79+) — Future releases

## Notes

- Integration tests cover real-world workflow scenarios (agent states, scripts, approval flows, multi-routing)
- Documentation provides clear setup and troubleshooting guidance
- All tests pass without requiring changes to main CLI
- LSP is production-ready for IDE plugin integration


