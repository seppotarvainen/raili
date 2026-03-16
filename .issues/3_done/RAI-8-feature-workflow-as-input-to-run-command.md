# RAI-8: workflow as an input to run command

**Type:** feature

## Description
Allow users to specify an alternative workflow YAML file to `raili run` instead of requiring `.raili/workflow.yaml`. This enables multiple workflow configurations (e.g., `workflow-dev.yaml` for quick sanity checks) in a single repository while keeping the current default behavior. The CLI should accept a `--workflow <file>` flag and the loader must accept a runtime-provided path.

## Documentation References
- documentation/usage
- documentation/states.md

## Code References
- src/cli.ts (main command parsing, run command flag parsing)
- src/run.ts (runCommand, entrypoint for executing runs)
- src/workflowLoader.ts (loadWorkflowConfig, loadYamlFile, buildStateMachine)
- src/context.ts (loadContext/getCurrentState) — verify resume behavior when using alternative workflow
- src/types.ts (WorkflowConfig type) — ensure loader accepts alternate path
- __tests__/unit (add tests covering CLI flag parsing and loader behavior)

## Acceptance Criteria
- [ ] `raili run` without flags continues to use `.raili/workflow.yaml` (no behavior change).
- [ ] `raili run --workflow workflow-dev.yaml` loads `.raili/workflow-dev.yaml` (or workflow-dev.yaml path relative to cwd) and runs that workflow.
- [ ] CLI accepts `--workflow <path>` and validates the referenced file exists; missing file produces a clear, fail-fast error.
- [ ] `loadWorkflowConfig` is extended (or overloaded) to accept an optional workflow path argument; all existing validation (initial, states, sub-workflow rules) is preserved.
- [ ] Unit tests added under `__tests__/unit` that mock filesystem and verify: default load, alternate-file load, non-existent-file error, and resume behavior with context.json when using an alternate workflow.
- [ ] Documentation updated: `documentation/usage` contains an example of `raili run --workflow workflow-dev.yaml` and explains precedence and path resolution.



