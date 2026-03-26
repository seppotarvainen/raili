# RAI-33: Finish renaming Engine to Runner

**Type:** improvement

## Description
The core component that executes workflows was renamed to `Runner` (class in src/runner/Runner.ts), but many code locations, tests, and documentation still refer to it as "Engine". This ticket standardizes the naming: keep the state type `engine` as-is, but rename all references to the execution component from "Engine" to "Runner" (variable names, helper functions, log strings, comments, and docs) for clarity and to avoid confusion with the `engine` state type.

## Documentation References
- documentation/routing.md
- documentation/states.md
- documentation/usage/run.md
- docs/workflow-yaml.md [File removed as redundant (26.3.2026)]

## Code References
- src/run.ts (local variable creation & usage: `const engine = new Runner(...)`, await engine.run())
- src/cli.ts (caller flows and help text where applicable)
- src/runner/Runner.ts (class already renamed; ensure no remaining "Engine" strings)
- src/runner/StateRunner.ts (comments / imports referring to Runner/Engine)
- src/runner/stateRunnerUtils.ts (comments)
- __tests__/unit/Engine.expose.test.ts
- __tests__/unit/engine.approval.test.ts
- __tests__/unit/engine.success.test.ts
- __tests__/unit/runner.test.ts
- __tests__/unit/* (search and update any tests using a variable named `engine` to `runner` and filenames containing `engine` where appropriate)

Note: The above list is intentionally conservative. A repo-wide check for the literal token "Engine" (case-insensitive) must be run and each match assessed: if it refers to the core execution component, update to "Runner"; if it refers to the `engine` state type (YAML examples, `type: engine`), leave unchanged.

## Acceptance Criteria
- [x] All source files that refer to the execution component as "Engine" are updated to use "Runner" (variable names, function names, console messages, and comments). — run.ts and src/runner are updated.
- [x] Unit tests updated: variable names changed from `engine` → `runner` where they instantiate the execution component. (Tests edited; test agent will verify behavior.)
- [ ] Documentation updated: files listed above no longer describe the execution component as "Engine"; they refer to "Runner" while still describing `type: engine` state semantics.
- [ ] Repo search shows no remaining references to the execution component named "Engine" (case-insensitive) outside historical commit messages; only `type: engine` occurrences remain where appropriate.
- [ ] All tests pass (run `npm test`): no test failures introduced by renaming.
- [ ] PR includes a short note in the changelog or PR description explaining the rename and clarifying that state type `engine` remains unchanged.

Note: Code and tests updated; build/test agents should be run to validate compilation and test outcomes.

## Suggested Tests and Implementation Notes
- Update unit tests in __tests__/unit/** that currently instantiate Runner and assign it to a variable named `engine` — rename the variable to `runner`. Keep mocks and assertions identical.
- Rename test files that are strictly about the core component from `engine.*.test.ts` → `runner.*.test.ts` or update their contents to reflect the new naming; ensure test import paths remain valid.
- Add a small integration test (in __tests__/integration) that runs a minimal workflow and asserts the run completes; this validates runtime logging and message strings.
- Before PR merge, run a case-insensitive grep for "\bEngine\b" and review matches. Automate this as an npm script (optional): `npm run check-naming`.

---

Slug: finish-renaming-engine-to-runner

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>
