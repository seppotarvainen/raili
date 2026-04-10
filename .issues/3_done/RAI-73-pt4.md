# RAI-73 — Part 4: Integration tests for `workflow` variable

**Parent ticket:** RAI-73 (RAI-73-improvement-add-default-workflow-variable.md)

## Scope
Add integration tests that verify the `workflow` variable is injected for default and named workflows, is present in agent prompts, and is available as `RAILI_VAR_WORKFLOW` in spawned shell commands.

## Files to Modify / Add
- __tests__/integration/workflow-variable-agent.test.ts — integration test for agent prompt interpolation
- __tests__/integration/workflow-variable-command.test.ts — integration test for command env export

## Implementation Steps
1. Create integration test `workflow-variable-agent.test.ts` following patterns in `__tests__/integration/*` and `testUtils.ts`:
   - Create tmp workspace, write workflow that uses `${workflow}` in agent prompt, write agent registry and agent file, mock `spawn` to capture copilot call, run `runCommand(tmp, 'clean', {})`, assert `ctx.vars.workflow === 'main'` and that the agent prompt contained `main`.
2. Create integration test `workflow-variable-command.test.ts` that creates a workflow with a command `echo $RAILI_VAR_WORKFLOW`, mock `spawn` to capture `env`, run `runCommand`, and assert `capturedEnv.RAILI_VAR_WORKFLOW === 'main'`.
3. Add tests for named workflow `--workflow dev` and for continue/persistence behavior.
4. Ensure cleanup of environment variables using `cleanupRailiEnvVars()` in afterEach.

## Acceptance Criteria
- [x] Integration tests added and following repository testing patterns
- [x] Tests assert workflow variable injection for default and named workflows
- [x] Agent prompt and shell env assertions implemented

## Context from Parent
Relevant excerpts from parent ticket:
- Integration test examples and snippets from the parent ticket describing expected behavior and test patterns (see parent ticket lines ~123–194 and ~196–217).