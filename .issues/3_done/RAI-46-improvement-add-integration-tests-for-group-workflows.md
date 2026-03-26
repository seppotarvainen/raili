# RAI-46: Add integration tests for group workflows

**Type:** improvement

## Description
Add comprehensive integration tests for the "group workflow" feature verifying loading, flattening, execution, routing, variable sharing, output storage, and context persistence. These tests exercise the engine end-to-end using established test utilities and child_process mocks so behavior is deterministic and isolated.

## Documentation References
- documentation/workflow-yaml.md [File removed as redundant (26.3.2026)]

## Code References
- src/run.ts (runCommand)
- src/context/context.ts (loadContext)
- __tests__/integration/testUtils.ts (createTmpWorkspace, writeWorkflow, writeAgentRegistry, fakeChild, etc.)
- __tests__/integration/agent.test.ts (example patterns and mocks)

## Implementation Plan
1. **__tests__/integration/group.integration.test.ts** — Create the new integration test file containing the 5 tests described below. Use testUtils helpers (createTmpWorkspace, writeWorkflow, writeAgentRegistry, writeAgentFile, fakeChild) and jest.mock('child_process').
2. **Test scaffolding (file top)** — Import runCommand, loadContext, and utilities from testUtils. Mock child_process.spawn as in other integration tests.
3. **Test 1: Simple group routing** — Write a main workflow that references a sub-workflow (use writeNamedWorkflow for sub-workflow). Simulate copilot returning `done` on sub-workflow terminal state and assert flattened history contains 5 states.
4. **Test 2: Group with approval** — Create main workflow with group state that has `approval`. Simulate sub-workflow execution and set process.env.RAILI_MANUAL_CHOICE = 'PASSED'. Assert routing to next state.
5. **Test 3: Group resumption** — Start a run that stops after N sub-workflow states by simulating partial completion (spawn returns outputs for first two states only), then runCommand again to resume and assert history includes resumed states without re-execution of completed ones.
6. **Test 4: Shared variables** — Define `inputs` on parent workflow and reference ${ticket_id} in sub-workflow. Pass ticket_id via runCommand and assert RAILI_VAR_TICKET_ID present during sub-workflow agent call and interpolated prompt.
7. **Test 5: Sub-workflow outputs** — Configure a sub-workflow state to `output.store: true`, produce output via fakeChild, and then have a later sub-workflow state use the stored output to determine transition key. Assert output file exists and that transitions used the stored output.
8. **Run tests** — Execute `npm test` locally to verify all assertions. Fix any test flakiness by adjusting timing (use fakeChild immediate emission) and strict path checks.

## Examples

### Example workflow YAML (main)
```yaml
initial: setup
states:
  setup:
    type: engine
  group_code:
    type: group
    workflow: sub_code
    transitions:
      done: cleanup
  cleanup:
    type: engine
```

### Example sub-workflow YAML (sub_code)
```yaml
initial: analyze
states:
  analyze:
    type: agent
    agent: test_agent
    transitions:
      continue: code
  code:
    type: agent
    transitions:
      done: review
  review:
    type: agent
    output:
      store: true
    transitions:
      done: END
```

### Expected behavior
- After run, `.raili/main/context.json` contains a stateHistory with entries: setup, analyze, code, review, cleanup (5 entries).
- `.raili/main/outputs/<state>.md` exists for states with `output.store: true`.
- Parent-provided variables (e.g., ticket_id) are available as `RAILI_VAR_TICKET_ID` during sub-workflow agent runs.

## Test Plan

### Integration tests (`__tests__/integration/`)
- **File:** `__tests__/integration/group.integration.test.ts`
- **Setup:**
  - Use `createTmpWorkspace()` to create a temp dir and scaffold `.raili/main`.
  - Use `writeWorkflow()` and `writeNamedWorkflow()` to write main and sub-workflows.
  - Use `writeAgentRegistry()` and `writeAgentFile()` to register agents.
  - Mock `child_process` as in `agent.test.ts`: `jest.mock('child_process', () => ({ spawn: jest.fn() }));` and import `spawn`.
  - Use `spawn.mockImplementation((cmd: string) => { if (cmd === 'copilot') return fakeChild('<stdout>', '', 0); return fakeChild('', '', 0); });`
  - Call `await runCommand(tmpDir, 'clean', { /*inputs*/ })`.
  - Use `loadContext(tmpDir)` to inspect `.raili/main/context.json`.

- **Test case sketches:**
  1. Simple group routing: simulate `copilot` returning `...\ndone` for the review state; assert flattened history length == 5 and includes each state name in order.
  2. Group with approval: set `process.env.RAILI_MANUAL_CHOICE = 'PASSED'` before run; ensure routing goes to the correct next state.
  3. Group resumption: run first time with `spawn` only returning outputs for first two sub-states (exit early), then run again with mock returning remaining outputs; assert no duplicate re-execution of first two states.
  4. Shared variables: pass `{ ticket_id: 'T-123' }` to runCommand; inside spawn mock capture `process.env.RAILI_VAR_TICKET_ID` and assert it equals 'T-123'; also assert prompt contains the interpolated value.
  5. Sub-workflow outputs: after run, assert output file exists at `.raili/main/outputs/<state>.md` and that subsequent state used the stored output for routing.

- **Mock patterns:** follow `__tests__/integration/agent.test.ts` and `testUtils.ts` (fakeChild, cleanup helpers).

## Acceptance Criteria
- [x] `__tests__/integration/group.integration.test.ts` exists and follows testUtils patterns
- [x] All tests pass under `npm test` in CI local run
- [x] `.raili/main/context.json` contains flattened, sequential stateHistory entries for group-expanded states
- [x] Output files are created for states configured with `output.store: true`
- [x] Variables declared by parent workflows are interpolated and exported to sub-workflows


Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>

## Implementation notes
- [x] Fixed group flattening in src/workflow/workflowLoader.ts to prefix internal sub-state transition targets so flattened transitions reference namespaced IDs (e.g. 'code' -> 'group_code.code').
- [x] Fixed duplicate state recording bug in src/runner/Runner.ts (routeToNext/engine auto-fallthrough/feedback recording) so state entries are only recorded on enterState.

Files modified:
- src/workflow/workflowLoader.ts
- src/runner/Runner.ts

