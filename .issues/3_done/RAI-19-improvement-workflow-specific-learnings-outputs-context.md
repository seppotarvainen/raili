# RAI-19: Learnings, outputs, and context should be workflow specific

**Type:** improvement

## Description
Make learnings, outputs, and runtime context scoped per-workflow directory under .raili (e.g., .raili/main/, .raili/test/) so artifacts for parallel or named workflows do not mix. Registries (agent and script) remain at .raili/ root and are shared. Provide a --workflow <name> CLI flag (default: "main") so `raili run` operates on .raili/main by default and `raili run --workflow test` runs .raili/test.

This change clarifies ownership of outputs, enables safe parallel workflows, and prevents accidental cross-contamination of artifacts and context.

## Documentation References
- documentation/output.md
- documentation/usage
- documentation/states.md

## Code References
- src/cli.ts (CLI flag handling, default workflow selection)
- src/run.ts (entrypoint for `raili run` behavior)
- src/workflowLoader.ts (load workflow.yaml from workflow-scoped directory)
- src/context.ts (persist and load context.json from workflow directory)
- src/outputStore.ts (write outputs to workflow-scoped outputs/)
- src/learningStore.ts (store learnings under workflow-scoped learnings/)
- src/pathUtils.ts (helper for resolving .raili/<workflow> paths)
- src/registryValidator.ts (ensure agent/script registries remain at .raili root)
- src/scriptRegistry.ts (registry lookup - ensure path resolution is relative to repo root)
- src/agentRegistry.ts (registry lookup)
- src/init.ts (update `raili init` scaffolding to create .raili/<workflow>/ structure)
- src/variableInterpolation.ts (ensure variables resolution uses correct workflow vars.yaml)

## Acceptance Criteria
- [x] CLI: `raili run` uses workflow "main" by default and `raili run --workflow test` runs .raili/test/workflow.yaml
- [x] File layout: Each workflow directory supports workflow.yaml, vars.yaml, context.json, outputs/, learnings/ (example structure added to documentation)
- [x] Registries: agent-registry.json and script-registry.json remain in .raili/ root and are validated before execution; missing registries fail fast
- [x] Context: Context persistence and resume load/save use the selected workflow directory and do not mix data across workflows
- [x] Outputs/Learnings: Outputs written to .raili/<workflow>/outputs and learnings to .raili/<workflow>/learnings
- [x] WorkflowLoader: Resolves workflow-relative files and falls back to .raili/ vars only when workflow vars.yaml missing
- [x] Init: `raili init` creates a default .raili/main scaffold (workflow.yaml, vars.yaml, outputs/, learnings/)
- [x] Fail-fast when registry entries point to non-file paths (prevents EISDIR when reading agent/script files)
- [x] Unit tests added: Unit tests under __tests__/unit covering workflow resolution, context read/write, output/learning store paths, and registry validation. Integration test under __tests__/integration pending (not yet added).
- [x] Documentation updated: documentation/output.md and documentation/usage updated with the new layout and sample CLI usage


--

Notes and rationale:
- This is an improvement (architectural change) that makes storage deterministic and isolated per declared workflow name.
- Fail-fast behavior must be preserved: missing workflows or missing registry references should error immediately.
- Backwards compatibility: No backwards compatibility needed, there's only one person using this system.

Acceptance update: CLI now fails fast when --workflow is provided and the workflow's context.json is missing; it no longer prompts to start a clean run. (Implemented in src/cli.ts and src/context.ts)

