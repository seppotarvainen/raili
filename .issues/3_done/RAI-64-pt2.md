# RAI-64 — Part 2: Implement `raili create` command and CLI wiring

**Parent ticket:** RAI-64 (RAI-64-feature-add-create-command.md)

## Scope
Implement the `raili create -w <workflowname>` command, CLI parsing, help text, and tests. This part depends on the template helpers extracted in Part 1 and wires them into a new createCommand that creates the .raili/<workflow>/ layout.

## Files to Modify
- src/cli/railiCommand.ts — add `create` property to RailiCommand class
- src/cli.ts — add `parseCreateArgs()` and dispatch branch to run createCommand
- src/cli/create.ts — NEW file implementing `createCommand(cwd: string, workflowName: string)`
- src/cli/help.ts — add help entry for `create`
- src/types.ts — reuse or add small types for CLI args if necessary
- __tests__/unit/create.test.ts — new unit tests covering happy and error paths
- __tests__/integration/create.test.ts — new integration test verifying created workflow is loadable
- documentation/usage/quickstart.md — mention the new command (docs update)

## Implementation Steps
1. Add `create` boolean (or command enum) to src/cli/railiCommand.ts so the main parser recognizes the `create` verb.
2. Implement `parseCreateArgs(args: string[]): { workflow: string }` in src/cli.ts; throw when `-w` missing or invalid.
3. Implement src/cli/create.ts with `createCommand(cwd, workflowName)` that:
   - Validates workflowName (non-empty, no path separators)
   - Ensures `.raili/` exists in cwd (fail-fast if missing per Raili rules)
   - Fails if `.raili/<workflowName>` already exists
   - Uses helpers from src/init.ts (from Part 1) to generate workflow.yaml and registries, writes files, and creates outputs/ learnings/ dirs
   - Returns `{ created: true, workflowName }` on success
4. Wire the new command into src/cli.ts main dispatcher: when command.create true, call parseCreateArgs and createCommand and exit with appropriate codes (0 success, 1 expected errors, 2 usage errors)
5. Add help text entry in src/cli/help.ts
6. Add unit tests covering: successful create, already exists error, invalid name, missing -w, parseCreateArgs behavior
7. Add integration test that calls createCommand and verifies workflow can be loaded (uses test helpers/createTmpWorkspace as per repo patterns)
8. Update quickstart docs to mention `raili create -w <name>` and expected directory layout.

## Acceptance Criteria
- [x] `raili create -w <workflowname>` is dispatched from main()
- [x] Command creates `.raili/<workflowname>/` with workflow.yaml, vars.yaml, outputs/, learnings/
- [x] Command fails fast if workflow exists or name invalid or `.raili/` missing
- [x] parseCreateArgs behavior tested (missing flag, missing value, valid case)
- [x] Unit and integration tests exist and pass
- [x] Help text updated
- [ ] Quickstart docs updated
- [ ] Exit codes: 0 success, 1 expected errors, 2 usage errors

## Context from Parent
(From parent ticket: Implementation Plan steps 1,2,4,5,6 and Test Plan)

> 1. **src/cli/railiCommand.ts** — Add `create: boolean` property to `RailiCommand` class. Set it to true when value is 'create'.
> 
> 2. **src/cli.ts** — Add `parseCreateArgs()` function that parses `-w <workflowname>` flag. Return a type like `{ workflow: string }` or throw if `-w` is missing.
> 
> 4. **src/cli/create.ts** (new file) — Create `createCommand(cwd: string, workflowName: string)` function that:
>    - Validates workflow name (no empty strings, no path separators like `/` or `\\`)
>    - Checks if `.raili/<workflowName>` already exists → throw error if true (fail-fast)
>    - Creates `.raili/<workflowName>/` directory
>    - Creates `.raili/<workflowName>/outputs/` and `.raili/<workflowName>/learnings/` subdirectories
>    - Writes `workflow.yaml` using helper from step 3
>    - Writes `vars.yaml` (empty template)
>    - Returns success object: `{ created: true, workflowName: string }`

Make sure Part 1 is implemented and landed before Part 2 (pt1 is foundational). Ensure each part is independently testable per the splitting guidelines.
