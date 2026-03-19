# RAI-23: Test fails with run-log

**Type:** bug

## Description
The run-log integration test expects workflow-declared inputs (vars.yaml) to be present in the persisted context after a clean run; currently the test shows last.vars is empty. Root cause: when runCommand is invoked in "clean" mode the workflow-scoped vars file (.raili/<workflow>/vars.yaml or .raili/vars.yaml) is not loaded into the initial execution context. As a result appendRunLog reads the saved context and finds no vars to include in run-log.jsonl.

This causes run-log entries to omit logged inputs even when workflow vars were provided on disk. The failure reproduces in __tests__/integration/run-log.integration.test.ts which writes .raili/main/vars.yaml but calls runCommand(..., 'clean', {}).

## Documentation References
- documentation/variables.md
- documentation/output.md

## Code References
- __tests__/integration/run-log.integration.test.ts (integration test that fails)
- src/run.ts (runCommand) — should load workflow vars for clean runs
- src/runLog.ts (appendRunLog) — reads context and writes run-log.jsonl
- src/context.ts (saveContext/loadContext) — persistence of vars into context.json
- src/cli.ts (loadVarsFile, collectVars) — contains vars-file loading logic (currently used only by CLI)
- src/pathUtils.ts (resolveWorkflowDir) — workflow dir resolution used by vars loading and run-log
- src/workflowLoader.ts (loadWorkflowConfig) — declared inputs used to filter vars included in run-log

## Analysis / Rationale
The CLI path (raili run) already supports reading vars.yaml via loadVarsFile when run through the interactive CLI (collectVars). However unit/integration code paths call runCommand directly (tests and programmatic usage). runCommand currently initializes context for clean runs using initializeContext(vars) without reading workflow vars files, so tests that write vars.yaml before invoking runCommand('clean') expect the run to pick them up but the code does not.

Fixing runCommand to read workflow-scoped vars.yaml (workflowDir/vars.yaml, falling back to .raili/vars.yaml) and merge them (respecting declared inputs) into the initial context for clean runs will make run-log include the expected variables and satisfy the failing test.

## Acceptance Criteria
- [x] runCommand in clean mode loads workflow vars from .raili/<workflow>/vars.yaml (or fallback .raili/vars.yaml) and merges them into the initial context, filtered to declared workflow inputs
- [x] The existing integration test __tests__/integration/run-log.integration.test.ts passes (last.vars contains ticket_id: 'T1')
- [x] No other behavior of runCommand changes for non-clean runs (vars precedence preserved: CLI flags > vars file > interactive prompts)
- [x] Unit tests added/updated under __tests__/unit to cover: runCommand clean-mode var loading and appendRunLog behavior when vars present
- [ ] Integration test asserts that run-log.jsonl contains logged inputs only for inputs where input.log: true (existing test already covers this)
- [ ] Documentation updated (if needed) to state that programmatic runs (runCommand) in clean mode load .raili/<workflow>/vars.yaml the same way the CLI does

## Suggested Implementation Notes
- Minimal fix: modify src/run.ts to read vars file for clean-mode before calling initializeContext. Use workflowConfig.inputs to filter allowed keys. Do not change CLI behavior.
- Option A (quick): inline small YAML-read & filter logic (no new module) in run.ts — import js-yaml and mirror cli.loadVarsFile semantics for declared inputs.
- Option B (cleaner): extract loadVarsFile from src/cli.ts into src/varsLoader.ts, reuse it both from cli.ts and run.ts (avoid code duplication). Update imports accordingly.

## Tests
- Add unit tests in __tests__/unit for run.ts behavior: when .raili/main/vars.yaml contains declared inputs, calling runCommand(...,'clean', {}) results in context.json containing those vars and appendRunLog emits them.
- Ensure existing integration test (__tests__/integration/run-log.integration.test.ts) passes without modification.


---

Slug: test-fails-with-run-log

Filename created: .issues/1_todo/RAI-23-bug-test-fails-with-run-log.md

