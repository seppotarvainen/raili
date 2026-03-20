# RAI-29: Refactor cli arguments using command-line-args package

**Type:** improvement

## Description
Refactor the ad-hoc CLI argument parsing in src/cli.ts to use the mature `command-line-args` package (already installed). This centralizes parsing logic, improves correctness for repeated/typed flags (for example multiple --var entries), and makes the codebase easier to maintain. Introduce a typed shape `RailiRunArgs` so downstream modules can consume strongly-typed run arguments.

## Documentation References
- documentation/usage/run.md
- documentation/variables.md

## Code References
- src/cli.ts (main, hasFlag, parseVarFlags, collectVars, promptRunMode)
- src/run.ts (runCommand, RunMode)
- src/types.ts (add/export RailiRunArgs or create src/cli/args.ts and export type)
- src/varsLoader.ts (loadVarsFile) — ensure flag semantics match file-loading precedence
- src/cli/help.ts (update help text to reflect canonical flags)
- __tests__/unit/cli.collectVars.test.ts (update to use new parsing)
- __tests__/unit/cli.promptRunMode.test.ts
- __tests__/unit/cli.stats.test.ts
- __tests__/unit/run.runCommand.test.ts and run.workflowFlag.test.ts

## Acceptance Criteria
- [x] Replace ad-hoc parsing in src/cli.ts with parsing via `command-line-args`.
- [x] Export a typed interface `RailiRunArgs` (recommended location: src/types.ts or src/cli/args.ts) that describes the parsed flags (mode, workflow, vars map, any shorthand flags). Other modules (runCommand) accept/use this type.
- [x] `--var key=value` semantics supported; repeated `--var` entries collect into a final vars map. Parsing must allow values containing `=`.
- [x] Standardize flags while preserving clear UX; at minimum support: `--workflow <path>` (short `-w` optional), `--clean`, `--continue`, repeated `--var <k=v>`, and `--help`/`-h` behavior. Document chosen short flags in CLI help.
- [x] Update unit tests in __tests__/unit that depend on CLI parsing to assert the new behavior. Ensure mocked inputs and environment handling still produce the same high-level behavior. (Integration tests should remain unchanged.)
- [ ] All existing unit tests pass after updates; CI should be green.
- [x] Add a small unit test that asserts repeated `--var a=1 --var b=2 --var a=3` merges into {a: '3', b: '2'} (flags override earlier ones).
- [x] Ensure `collectVars` and `loadVarsFile` precedence remains: flags > vars file > interactive prompt for clean runs.


---

Notes / Implementation suggestions


---

Notes / Implementation suggestions
- Create a small arg schema for command-line-args describing each option and use the library's repeated/collect feature for `--var`. For example, parse raw `--var` strings into a Record<string,string> after parsing, then validate and type into RailiRunArgs.
- Prefer adding the exported RailiRunArgs to src/types.ts so it is available across the codebase; alternatively create src/cli/args.ts and export from index if cleaner.
- Update CLI help text in src/cli/help.ts and any generated docs (src/cli/generated-docs.ts) so usage reflects the chosen canonical flags.
- Update unit tests under __tests__/unit that mock process.argv or call CLI helpers; keep integration tests intact.



