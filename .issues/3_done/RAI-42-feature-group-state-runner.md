# RAI-RAI-42: Implement GroupStateRunner to execute group states

**Type:** feature

## Description
Create a GroupStateRunner that executes "group" states by running their flattened sub-workflow states transparently. The runner should execute the flattened states until a sub-workflow terminal state (marked out: true) is reached, parse its terminal stdout for the routing key, and return that outcome so the parent workflow can route normally.

## Documentation References
- docs/workflow-yaml.md [File removed as redundant (26.3.2026)]
- src/workflow/workflowLoader.ts

## Code References
- src/runner/Runner.ts (Runner.executeState, Runner.run)
- src/runner/StateRunner.ts (IStateRunner)
- src/runner/AgentStateRunner.ts (runAgentState)
- src/runner/ScriptStateRunner.ts (runScriptState)
- src/runner/CommandStateRunner.ts (runCommandState)
- src/runner/stateRunnerUtils.ts (processStateResult, buildEnvOverrides)
- src/workflow/workflowLoader.ts (loadWorkflowConfig, buildStateMachine)
- src/context/outputStore.ts (readLatestRun, saveOutput)

## Implementation Plan

1. **src/runner/GroupStateRunner.ts** — Create a new class implementing `IStateRunner` with signature:
   - export async function runGroupState(state: StateDef, cwd: string, vars?: Record<string,string>, workflowArg?: string): Promise<StateResult>
   - Implementation details:
     - Identify the group's flattened entry: the group state in `StateMachine` is already flattened by `loadWorkflowConfig` into states prefixed with `<group>.<sub>` and the original group state replaced with an engine skip to the entry. However, Runner currently treats group as a distinct type; implement runner to:
       - Inspect the parent state's config.group value (path) to derive the flattened entry prefix (state.id + '.') OR use the state.id to find candidate flattened states in the machine (prefixed names) — since Runner has access only to StateDef and not machine, implement runner to locate sub-states by scanning the filesystem-loaded sub-workflow: call `loadWorkflowConfig(cwd, workflowArg)` from `src/workflow/workflowLoader.ts` and derive flattened ids as `"<groupStateId>.<subId>"`.
     - Starting from entry state (first key in sub-workflow), execute states sequentially by delegating to existing state runners:
       - For each sub-state, dispatch to runAgentState, runScriptState, runCommandState, or handle approval/engine logic accordingly (reuse Runner.executeState's dispatch logic or call the exported helper functions runAgentState/runScriptState/runCommandState/runApprovalStep where appropriate).
       - After each sub-state run, perform exports handling: call Runner.handleExports-like behavior (merge exposed vars into context). Since GroupStateRunner cannot mutate Runner.private context directly, design GroupStateRunner to return a combined StateResult whose `exports` contains any exported vars from sub-states; Runner's outer flow will then call handleExports as usual.
     - When a sub-state marked `out: true` is reached, parse its stdout last non-empty line as the transition key (same logic as AgentStateRunner: last stdout line) and return { outcome: <key>, exports: combinedExports }.
     - Ensure outputs are stored per sub-state (use saveOutput/readLatestRun from context/outputStore) and follow same `processStateResult` logic by reusing `processStateResult` helper where possible.

2. **src/runner/Runner.ts** — Modify `executeState` dispatch to add a case for `config.type === 'group'` and call the new `runGroupState` function. Ensure `run()` loop continues to call handleExports and approval/feedback phases unchanged.

3. **src/runner/StateRunner.ts** — Verify `IStateRunner` signature matches the new runner. No change expected; confirm compatibility.

4. **src/runner/stateRunnerUtils.ts** — If needed, expose helper(s) used by GroupStateRunner to process shell/command/script results (`processStateResult`) so sub-state outputs and exports are handled consistently.

5. **Tests** — Add unit tests and integration tests (see Test Plan). Mock all external side effects.

## Examples

### Example workflow YAML
```yaml
initial: start
states:
  parent_group:
    type: group
    group: "subworkflow.yaml"
    on:
      PASSED: after_ok_group
      FAILED: after_fail_group
  after_ok_group:
    type: engine
    success: true
  after_fail_group:
    type: engine
    success: false

  # Flattened states will appear as 'parent_group.sub1', 'parent_group.sub2', etc.
```

Sub-workflow (subworkflow.yaml):
```yaml
initial: sub1
states:
  sub1:
    type: agent
    agent: analyzer
    output:
      store: true
    on:
      PASSED: sub2
  sub2:
    type: script # return exit code 0 or 1. The result is handled in "parent_group" state.
    script: do_thing 
    out: true
```

### Expected behavior / output
- Runner enters `parent_group` state; GroupStateRunner runs `parent_group.sub1` then `parent_group.sub2`.
- When `parent_group.sub2` (out:true) finishes, its returns e.g. exit code 0. The GroupStateRunner returns outcome `PASSED` to Runner which routes according to parent's transitions.
- `.raili/main/outputs/parent_group.sub1.md` and `parent_group.sub2.md` are created as usual.
- Context.stateHistory includes entries for `parent_group` (engine entry via skip) then `parent_group.sub1` and `parent_group.sub2` (full flattened history).

## Test Plan

### Unit tests (`__tests__/unit/`)
- **File:** `__tests__/unit/GroupStateRunner.test.ts`
- **Test case:** "parses outcome from out:true sub-state and returns exports"
  - Setup: Mock `loadWorkflowConfig` to return a simple sub-workflow with states `subA (agent)`, `subB (script, out:true)`.
  - Mock runAgentState/runScriptState to return controlled stdout/exports (use jest.mock pattern used in other unit tests).
  - Act: Call runGroupState for state id `parent_group`.
  - Assert: Returned outcome equals last non-empty line from subB stdout; returned exports include merged exports from subA/subB.

- **File:** `__tests__/unit/Runner-group.test.ts`
- **Test case:** "Runner dispatches to runGroupState when state.type==='group'"
  - Setup: Mock runGroupState to return outcome `X` and some exports.
  - Act: Run Runner until next state.
  - Assert: Runner recorded exports in context.vars and routed to the expected next state based on outcome `X`.

### Integration tests (`__tests__/integration/`)
Follow established patterns from `__tests__/integration/testUtils.ts`.

- **File:** `__tests__/integration/group.test.ts`
- **Test case:** "group state executes sub-workflow and parent routes correctly"
  - Setup:
    - tmp = createTmpWorkspace()
    - writeWorkflow(tmp, `initial: start\nstates:\n  start:\n    type: group\n    group: "subworkflow.yaml"\n  done:\n    type: engine\n`)
    - writeNamedWorkflow(tmp, 'main', '') as needed and write `subworkflow.yaml` into `.raili/main/subworkflow.yaml` with two states: `s1` (script, output.store: true) and `s2` (script, out: true). Ensure registries point to no-op scripts.
    - jest.mock('child_process', () => ({ spawn: jest.fn() }));
    - spawn.mockImplementation(cmd => fakeChild('ok\napprove', '', 0)) for the terminal sub-state to emit `approve` as last line.
  - Act: await runCommand(tmp, 'clean', {});
  - Assert: loadContext(tmp).stateHistory contains flattened `start.s1`, `start.s2`; final routing moved to `done` based on `approve` mapping.

- **File:** `__tests__/integration/group_approval.test.ts`
- **Test case:** "group state can have approval or on transitions"
  - Setup: Create a group where one of the sub-states or group's mapping uses `approval` or `on`; set `process.env.RAILI_MANUAL_CHOICE='PASSED'` for approvals.
  - Assert: Runner honors approval flow and routes accordingly.

## Acceptance Criteria
- [x] Group states execute transparently: sub-states run sequentially and their outputs are saved per-sub-state.
- [x] Sub-workflow terminal state's parsed outcome (last non-empty stdout line) is returned and used by parent routing.
- [ ] Context.stateHistory contains flattened entries for all sub-workflow states.
- [ ] Integration test verifies group state executes sub-workflow and parent routes correctly.
- [ ] Integration test verifies group state works with approval/on transitions.
- [x] Unit test verifies GroupStateRunner parses outcome and merges exports.

---

**Notes & rationale**
- `src/workflow/workflowLoader.ts` already flattens group states into `<group>.<subId>` and replaces the group with an engine skip to the flattened entry. The GroupStateRunner implementation should align with how workflows are flattened: either drive execution using the flattened state ids (recommended) or re-load and iterate sub-workflow states. The Implementation Plan suggests using existing loader to derive entry and flattened ids so behavior matches the loader's flattening logic.


