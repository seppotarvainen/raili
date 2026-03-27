# RAI-55: Add a dry-run mode for validation without execution

**Type:** feature

## Description
Add a --dry-run (raili run --dry-run) that performs the full startup validation (workflow YAML/schema, state-machine build/validation, registries and referenced files, workflow reference checks, declared variables loading/merging) without entering the runner execution loop. This follows the project's fail-fast philosophy and provides a safe verification mode for CI and local checks.

## Documentation References
- README.md
- documentation/states.md
- documentation/routing.md

## Code References
- src/cli.ts (parseRunArgs, main)
- src/types.ts (RailiRunArgs)
- src/run.ts (runCommand)
- src/workflow/workflowLoader.ts (loadWorkflowConfig, buildStateMachine, validateStateMachine)
- src/registry/registryValidator.ts (validateAgentRegistry, validateScriptRegistry, validateWorkflowReferences)
- src/variables/varsLoader.ts (loadVarsFile)
- src/context/context.ts (loadContext, initializeContext, clearContext)
- src/cli/railiCommand.ts (RailiCommand)
- src/runner/runner.ts (Runner)
- __tests__/integration/testUtils.ts (createTmpWorkspace, writeWorkflow, writeAgentRegistry, fakeChild) — referenced for test patterns

## Implementation Plan
Ordered, file-level steps to implement dry-run mode. Make minimal, surgical changes.

1. **src/types.ts** — Update `RailiRunArgs` interface to include `dryRun?: boolean`.

2. **src/cli.ts** — Update `parseRunArgs(argv)`:
   - Add optionDefinition: `{ name: 'dry-run', type: Boolean }` (accept `--dry-run`).
   - Populate returned `RailiRunArgs.dryRun` with parsed['dry-run'].

3. **src/cli.ts** — Update `main()` around the `command.run` branch:
   - After `const parsed = parseRunArgs(runArgs);` if `parsed.dryRun` is true then avoid interactive prompts: do NOT call `promptRunMode()` or `collectVars()`.
   - Determine `mode` as `parsed.mode ?? 'clean'` for validation purposes (clean ensures vars file loading).
   - Merge vars non-interactively: when `mode === 'clean'` call `loadVarsFile(process.cwd(), declaredNames, workflowPath)` to combine file vars with `parsed.vars` (flags override file). Do not prompt for missing inputs.
   - Call `await runCommand(process.cwd(), mode, vars, workflowPath, parsed.dryRun);` (new argument).
   - Keep the current interactive flow unchanged when `parsed.dryRun` is false.

4. **src/run.ts** — Change `runCommand` signature to accept an optional `dryRun: boolean = false` parameter.
   - Ensure existing validations (workflow load, buildStateMachine, validateStateMachine, registry validations, validateWorkflowReferences, vars loading/merging for clean runs) are executed before any early return.
   - When `skipped.length > 0` (skip-confirmation), avoid prompting when `dryRun === true` — treat as accepted (so dry-run remains non-interactive). Currently code already bypasses prompt in non-TTY contexts; explicitly bypass for dry-run too.
   - After performing validations and preparing `context` and `allVars` (exposing RAILI_VAR_*), if `dryRun === true` then:
     - Print a clear summary message (e.g. "Dry-run validation succeeded: no execution performed.") to stdout.
     - Return early without constructing `Runner` or calling `runner.run()` and without calling `appendRunLog()`.

5. **src/cli.ts** — Update import/usage sites if function signature changed (runCommand import remains, but call sites updated). Only `src/cli.ts` calls `runCommand`, so update that call.

6. **Unit tests** — Add unit tests for `parseRunArgs` and `runCommand` behavior (see Test Plan). Mock interactive flows so dry-run is non-interactive.

7. **Integration tests** — Add an integration-style test to verify dry-run validates registries and workflow references but does not invoke child processes (use existing child_process mock pattern in tests).

8. Update documentation/README.md briefly to mention `--dry-run` usage and semantics.

## Examples

### CLI usage

- Validate workflow and registries without execution:

```bash
# Validate using flags and vars from .raili/main/vars.yaml
raili run --dry-run

# Validate a named workflow without executing and with inline vars
raili run -w main --dry-run --var ticket_id=123
```

### Before / After (types.ts)

Before:

```ts
export interface RailiRunArgs {
  workflow?: string;
  mode?: 'clean' | 'continue';
  vars: Record<string, string>;
  help?: boolean;
}
```

After:

```ts
export interface RailiRunArgs {
  workflow?: string;
  mode?: 'clean' | 'continue';
  vars: Record<string, string>;
  help?: boolean;
  dryRun?: boolean;
}
```

### Expected Console Output (successful dry-run)

```
Loaded workflow: .raili/main/workflow.yaml
Validated workflow schema and transitions (initial: start)
Validated agent-registry.json and script-registry.json
All referenced agents/scripts found and paths exist
Loaded variables: ticket_id=123, branch=feature/x
Dry-run validation succeeded: no execution performed.
```

## Test Plan

Follow existing patterns in `__tests__/integration/testUtils.ts` and unit tests style.

### Unit tests (`__tests__/unit/`)

- **File:** `__tests__/unit/cli.parseRunArgs.test.ts`
  - Test case: "parseRunArgs recognizes --dry-run flag"
    - Setup: call `parseRunArgs(['--dry-run', '-w', 'main'])`
    - Act: inspect returned object
    - Assert: `result.dryRun === true` and `result.workflow === 'main'`

- **File:** `__tests__/unit/runCommand.dryrun.test.ts`
  - Test case: "runCommand performs validations but does not call Runner.run when dryRun=true"
    - Setup: Create a temp workspace using `createTmpWorkspace()`; write a minimal `workflow.yaml`, `agent-registry.json`, `script-registry.json`, and necessary agent/script files using `writeAgentRegistry`/`writeScriptFile` helpers.
    - Mock `Runner` constructor or spy on `Runner.prototype.run` to detect invocations (use `jest.spyOn(Runner.prototype,'run')`).
    - Act: call `await runCommand(tmp, 'clean', {}, undefined, true)`.
    - Assert: `Runner.prototype.run` was not called; function returns without throwing. Optionally assert console output contains "Dry-run validation succeeded".

### Integration test (`__tests__/integration/`) — recommended

- **File:** `__tests__/integration/dryrun.test.ts`
  - Test case: "dry-run validates registries and workflow references but skips execution"
    - Setup:
      - const tmp = createTmpWorkspace();
      - writeWorkflow(tmp, `initial: start\nstates:\n  start:\n    type: script\n    script: check\n    on:\n      PASSED: done\n  done:\n    type: engine\n`);
      - writeScriptRegistry(tmp, { check: { path: './scripts/check.sh' } });
      - writeScriptFile(tmp, './scripts/check.sh', '#!/bin/sh\necho ok\n');
      - writeAgentRegistry(tmp, {});
    - Mock child_process.spawn globally so no real processes spawn (but dry-run should not reach spawn anyway).
    - Act: await runCommand(tmp, 'clean', {}, undefined, true);
    - Assert:
      - No child process was spawned (spawn.mock.calls.length === 0)
      - No outputs were created under `.raili/main/outputs` (nothing executed)
      - Function returns successfully and console contains the dry-run summary message.

Notes on mocking and helpers:
- Use existing patterns: `jest.mock('child_process', () => ({ spawn: jest.fn() }));` and `fakeChild` from testUtils to simulate processes when needed.
- Use `cleanupRailiEnvVars()` in afterEach to clean env modifications.

## Acceptance Criteria
- [x] `parseRunArgs` accepts `--dry-run` and `RailiRunArgs.dryRun` is set accordingly.
- [x] `raili run --dry-run` runs all validations: workflow loading + schema validation, state-machine build and validation, registry loading and file existence checks, workflow reference validation, and (for clean-mode) vars file loading and merging.
- [x] Dry-run is non-interactive: it does not prompt for skip confirmation or input collection.
- [x] Dry-run does not create or modify runtime artifacts (no Runner.run execution, no outputs written, and no appendRunLog invocation).
- [x] Unit and integration tests cover the dry-run behavior, using established test utilities and mocks.


---

*Implementation notes:* prefer minimal changes to keep runner and core behavior unchanged. Dry-run should be orthogonal and avoid adding unexpected side-effects.
