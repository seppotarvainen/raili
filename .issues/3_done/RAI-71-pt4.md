# RAI-71 — Part 4: CLI wiring & integration tests

**Parent ticket:** RAI-71 (RAI-71-feature-add-visual-command.md)

## Scope
Wire the `raili visual` CLI entry (railiCommand and cli.ts) to call visualCommand implemented in Part 3, add argument parsing (`--workflow`, `--format`, `--out`), and add integration tests verifying end-to-end CLI behavior and fail-fast registry checks.

## Files to Modify
- src/cli/railiCommand.ts — small change: add `visual: boolean` property or support detecting 'visual' subcommand
- src/cli.ts — add parseVisualArgs() and CLI dispatch to call visualCommand() when invoked
- __tests__/integration/visual.test.ts — integration tests exercising the CLI (createTmpWorkspace style) including success and error cases (missing registry / missing agent)

## Implementation Steps
1. Update RailiCommand parsing so the 'visual' subcommand routes to main visual handler. Follow patterns in src/cli/schema.ts and src/cli/stats.ts.
2. Implement parseVisualArgs() using commandLineArgs to extract `--workflow`, `--format`, `--out` flags and `--help` handling.
3. Hook visualCommand(...) into main CLI flow; ensure it uses current working directory and exits cleanly after writing file or printing.
4. Add integration tests under __tests__/integration/visual.test.ts mirroring the parent ticket test plan (diagram.html creation, custom out, stdout, missing registry error, missing agent error). Use createTmpWorkspace and registry helpers.
5. Run tests locally (npm test) to ensure all units/integration pass (in repo CI environment tests will mock external processes per policy).

## Acceptance Criteria
- [x] `raili visual` dispatches to visualCommand with correct flags
- [x] Integration tests validate file output and error behavior
- [x] Command fails fast when registries are missing or references are invalid
- [x] Optional: Refactor `cli.main` function so that it takes optional args for easier testing.

## Context from Parent
Relevant plan excerpts:
- "src/cli/railiCommand.ts — Add `visual: boolean` property"
- "src/cli.ts — Add parseVisualArgs() and visual command handler"
- Integration test examples provided in the parent ticket
