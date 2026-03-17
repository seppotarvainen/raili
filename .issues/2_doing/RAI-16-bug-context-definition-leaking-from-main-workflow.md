# RAI-16: Context definition leaking from main workflow

**Type:** bug

## Description
When running an alternate workflow via `raili run --workflow workflow-dev.yaml`, the engine still reads declared inputs and descriptions from the default `.raili/workflow.yaml` (and prompts accordingly). The root cause is that the input-collection code path loads the default workflow instead of the workflow file the user requested. This causes incorrect prompts and ignores inputs defined in the chosen workflow file.

Suggested behavior: the engine must read inputs from the workflow file being executed. Optionally adopt a paired vars file naming convention (e.g. `vars.dev.yaml` or `.raili/vars.dev.yaml`) so `--workflow dev` automatically loads `.raili/vars.dev.yaml` — default remains `workflow.yaml` and `vars.yaml`.

## Documentation References
- documentation/usage/run.md
- documentation/variables.md

## Code References
- src/cli.ts (collectVars, loadVarsFile, main run argument parsing)
- src/run.ts (runCommand - accepts workflowPath and passes to loader)
- src/workflowLoader.ts (loadWorkflowConfig, buildStateMachine)
- src/init.ts (initCommand - template creation of workflow.yaml)
- src/context.ts (loadContext/saveContext - context persistence may be affected)

## Acceptance Criteria
- [x] collectVars() uses the exact workflow file provided via the CLI `--workflow` flag (or resolved name) when determining declared inputs.
- [x] When `raili run --workflow <path|name>` is used, loadWorkflowConfig is invoked with the resolved workflowPath in the same flow that prompts for inputs.
- [x] If adopting the paired vars-file convention: when running with workflow name or file suffix (e.g. `--workflow dev` or `--workflow workflow-dev.yaml`), the engine will prefer `.raili/vars.dev.yaml` (or `.raili/vars-<suffix>.yaml`) and fall back to `.raili/vars.yaml`. Documentation must be updated to describe the naming convention and precedence.
- [x] Unit tests added under __tests__/unit/ to verify:
  - collectVars prompts for inputs declared in the passed workflow file (mocking file loading and prompt behaviour)
  - loadVarsFile respects the new vars-file naming convention (if implemented)
  - runCommand passes workflowPath through to loadWorkflowConfig
- [x] Integration test under __tests__/integration/ demonstrating a clean run using an alternate workflow file reads the correct inputs and uses the corresponding vars file (mock filesystem and CLI args as needed).
- [x] Documentation updated: documentation/usage/run.md and documentation/variables.md reflect the corrected behavior and the new vars-file convention if implemented.
- [x] Backwards-compatible: default behavior remains `.raili/workflow.yaml` and `.raili/vars.yaml` when no `--workflow` flag is provided.


-- Implementation notes / scope analysis

Root cause located in src/cli.ts where collectVars() calls loadWorkflowConfig(cwd) with no workflowPath, while CLI parsing earlier extracts the --workflow flag and passes workflowPath into runCommand(). The minimal fix is to thread the workflowPath into collectVars (or to resolve declared inputs earlier in main before prompting) so prompts reflect the chosen workflow file. Supporting the suggested vars-file naming requires changes to loadVarsFile() to derive the vars filename from the resolved workflow name and to runCommand/collectVars to propagate that resolved workflow identifier.

Files that must be reviewed/changed together:
- src/cli.ts (primary) — collectVars signature should accept workflowPath and use loadWorkflowConfig(cwd, workflowPath)
- src/run.ts — ensure the same workflowPath is used consistently; confirm save/load of context still uses persistent .raili/context.json
- src/workflowLoader.ts — verify resolution semantics for bare names vs explicit filenames (already resolves .raili/<name> before cwd/<name>) and document mapping to vars file
- Documentation updates in documentation/usage/run.md and documentation/variables.md

Suggested tests to add/edit:
- __tests__/unit/cli.collectVars.test.ts — mock loadWorkflowConfig to return differing inputs and assert prompts reflect chosen file
- __tests__/unit/cli.loadVarsFile.test.ts — verify vars file lookup precedence and new naming (e.g., .raili/vars.dev.yaml then .raili/vars.yaml)
- __tests__/integration/run-alternate-workflow.test.ts — simulate a clean run with an alternate workflow and a matching vars file to validate end-to-end behavior (mock file access and stdin)


---

Slug: context-definition-leaking-from-main-workflow
