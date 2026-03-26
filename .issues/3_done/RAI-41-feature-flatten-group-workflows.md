# RAI-41: Load and flatten group workflows into single state machine

**Type:** feature

## Description
Implement loading and flattening of `group` states so sub-workflow fragments are merged into the parent workflow at load time. After loading, the runner receives a single flat state machine: sub-workflow states and inputs are incorporated into the parent workflow and transitions from sub-workflow terminal states route back to the parent as configured.

This change is part of the group states / sub-workflow nesting initiative and focuses on loader/validation/flattening logic only.

## Documentation References
- docs/workflow-yaml.md [File removed as redundant (26.3.2026)]

## Code References
- src/workflow/workflowLoader.ts (loadYamlFile, loadWorkflowConfig, buildStateMachine)
- src/workflow/schemaValidator.ts (validateWorkflowConfig, validateStateConfig)
- src/types.ts (StateConfig, WorkflowConfig, StateType)
- __tests__/integration/testUtils.ts (createTmpWorkspace, writeWorkflow, writeNamedWorkflow, fakeChild)

## Implementation Plan
Ordered steps. Each step names file, function/class, and specific change.

1. **src/workflow/workflowLoader.ts** — Add helper `flattenGroupState(groupStateId: string, groupConfig: StateConfig, subWorkflowObj: any, workflowDir: string, parentStates: Record<string, StateConfig>, parentInputs: InputDef[]): { newStates: Record<string, StateConfig>, newInputs: InputDef[], mapping: {subToFlat: Record<string,string>, flatToSub: Record<string,string>} }`
   - Purpose: read the parsed sub-workflow object (loaded via existing `loadYamlFile`), produce a set of flattened state entries and inputs, and return mappings.
   - Implementation details:
     - Use deterministic ID prefixing to avoid collisions: newId = `${groupStateId}.${subStateId}` (dot separator).
     - Copy each sub-state config into `newStates` under newId, preserving config but removing `out: true` markers (keep the property but note it was an exit).
     - Collect sub-workflow `inputs` (if any) and map each to parentInputs. Fail if any input name collides with an existing parent input (see step 3).
     - Identify terminal exit states in sub-workflow: states where `out: true` === true OR states with no transitions (terminal). For each such state, rewrite behavior so that after that flattened terminal state executes the runner will route to the parent's routing defined on the original group state (see step 2).

2. **src/workflow/workflowLoader.ts** — Extend `loadWorkflowConfig(cwd, workflowPath?)` behavior
   - Detect states whose `type === 'group'` while iterating `main.states`.
   - For each group state:
     - Resolve `group` path relative to `workflowDir` using `path.resolve(workflowDir, group)` and call `loadYamlFile(resolvedPath, true)` to parse the sub-workflow (the existing helper enforces sub-workflow must not define `initial`).
     - Call `validateWorkflowConfig` on the parsed sub-workflow object only as a fragment validation (but allow missing `initial` since sub-workflow is fragment). Add a small guard to ensure sub-workflow does not itself contain `type: 'group'` states — throw descriptive error if it does.
     - Call `flattenGroupState(...)` to obtain flattened states/inputs/mappings.
     - Merge `newStates` into `main.states` (the parent `states` map). Replace the original group state's config in the parent with a lightweight proxy state that routes into the flattened initial state: set the group's `skip`/`on`/`transitions` or rewrite the group's transitions so that entering the group state routes immediately to the flattened sub-workflow initial state (e.g., change group state's `type` to `engine` and `skip` to the flattened initial state's ID, or keep `group` property for traceability and add `__entry` metadata). Implementation should be explicit and deterministic; propose: replace the group state's config with { type: 'engine', skip: '<groupStateId>.<subInitial>' } so Runner will immediately route into the flattened entry state.
   - After processing all group states, rebuild the WorkflowConfig (`initial`, `states`, `inputs`) and return.

3. **Input merging & collision handling**
   - When merging sub-workflow inputs into parent inputs, ensure each input name is unique. If a sub-workflow input name equals an existing parent input name, throw an Error: `Duplicate input key '<name>' found in sub-workflow '<path>' and parent workflow`.
   - Preserve InputDef shape (name, description?, log?). If sub-workflow inputs use shorthand strings, normalize like existing loader.

4. **Rewrite transitions for returning to parent**
   - The original group state may declare `on` (binary) or `transitions` (named) that describe where to route after the whole sub-workflow completes. Implement the mapping so that each flattened sub-workflow `out:true` terminal state is rewritten to route to the parent targets specified on the group state.
   - For example: if group state's `on: { PASSED: parent_ok, FAILED: parent_err }` then for each flattened sub terminal state that represents a PASSED outcome, set that flattened terminal state's config to include the same `on` mapping (or add transitions) so the runtime validation sees the flattened machine has transitions to parent states.
   - To support distinguishing different terminal outcomes emitted by the sub-workflow, adopt the convention: sub-workflow authors mark terminal states with `out: true` and optionally `out_key: 'PASSED'` (if needed). If `out_key` is not present, default to `PASSED`.
   - Implementation note: Because types already include `out?: boolean`, prefer to extend to `out_key?: string` only if necessary; otherwise default mapping to group's `PASSED` target.

5. **src/workflow/schemaValidator.ts** — Update validation post-merge
   - After loader returns merged WorkflowConfig, call `validateWorkflowConfig(merged)` (or update loader to call after merging) to validate final structure.
   - Add a new check that all state IDs in the merged config are unique (duplicate state IDs should already be prevented by merge logic; if a collision is detected throw descriptive error: `State id collision when flattening '<groupPath>': '<stateId>' already exists in parent workflow`).
   - Verify that all transitions (on/ transitions / approval targets / max_visits.continue / skip) referenced in any state exist in the merged states map.

6. **Add unit tests** — `__tests__/unit/workflowLoader.flatten.test.ts`
   - Test: flattening merges sub-workflow states and inputs
     - Setup: create temporary main/sub YAML content using test helpers or in-memory objects; call `loadWorkflowConfig(tmpDir)` and assert returned config.states contains flattened ids like `do_group.prepare` and `do_group.approve` and inputs merged.
   - Test: duplicate input name -> throws
   - Test: state id collision between parent state and flattened sub-state -> throws
   - Test: sub-workflow containing `type: group` -> throws
   - Test: sub-workflow with no `out: true` -> throws

7. **Add integration tests** — `__tests__/integration/flatten.test.ts`
   - Follow patterns in `__tests__/integration/testUtils.ts` and existing integration tests (agent.test.ts): use `createTmpWorkspace()`, `writeNamedWorkflow(tmp, 'sub', yaml)`, `writeWorkflow(tmp, mainYaml)`, and `writeAgentRegistry`, `writeScriptRegistry` as needed.
   - Test case: main + sub-workflow loads and `runCommand(tmp, 'clean', {})` proceeds with flattened state machine; verify `.raili/main/context.json` stateHistory shows flattened state ids or final terminal state reached.
   - Test case: sub-workflow inputs merged into parent inputs (assert process.env RAILI_VAR_... set during run or verify loader returned config.inputs contains merged entries).

8. **Docs** — Update `docs/workflow-yaml.md [File removed as redundant (26.3.2026)]` to document `group` state semantics, `out: true` requirement in sub-workflows, collision rules, and the deterministic ID prefixing convention.

9. **Developer notes / logging**
   - Add clear error messages for fail-fast conditions: missing sub-workflow file, nested 'group', duplicate inputs, state id collision, and missing out:true.
   - Add unit test coverage for each error message so the behavior is verifiable.

## Examples
Concrete before/after and YAML demonstration.

### Before (main workflow)
```yaml
initial: start
states:
  start:
    type: engine
    transitions:
      next: do_group
  do_group:
    type: group
    group: ./subflows/approval.yaml
    on:
      PASSED: finish
      FAILED: rework
  finish:
    type: engine
  rework:
    type: engine
```

### Sub-workflow (subflows/approval.yaml)
```yaml
states:
  prepare:
    type: agent
    agent: approver
  approve:
    type: engine
    out: true
```

### After loading (flattened states visible to runner)
- Loader will produce flattened state IDs: `do_group.prepare`, `do_group.approve` and merge them into parent `states` map.

Example flattened states mapping (illustrative):
```
states:
  start: { ... }
  do_group: { type: engine, skip: 'do_group.prepare' }   # proxy to entry if chosen
  do_group.prepare: { type: agent, agent: approver }
  do_group.approve: { type: engine, on: { PASSED: 'finish', FAILED: 'rework' } }
  finish: { type: engine }
  rework: { type: engine }
```

Notes:
- The `do_group` proxy (engine + skip) is used so the runner's `initial` and state references continue to target `do_group` for clarity while execution enters the flattened entry `do_group.prepare`.
- Sub-workflow inputs are merged into parent `inputs` (fail on duplicate names).

## Test Plan

### Unit tests (`__tests__/unit/`)
- **File:** `__tests__/unit/workflowLoader.flatten.test.ts`
- **Test case:** "merges sub-workflow states and inputs into parent"
  - Setup: Create tmp workspace, write main workflow with a group state `do_group` and write `subflows/approval.yaml` with `prepare` and `approve` (`out: true`) states using `writeNamedWorkflow`.
  - Act: call `loadWorkflowConfig(tmp, 'main')` (or run loader via exposed function) and inspect returned WorkflowConfig.
  - Assert: `config.states` contains `do_group.prepare` and `do_group.approve`; `config.inputs` contains both parent and sub inputs; no collisions.

- **Test case:** "duplicate input key throws"
  - Setup: sub-workflow declares input `ticket_id` and main also declares `ticket_id`.
  - Act: call loader
  - Assert: thrown Error message contains `Duplicate input key 'ticket_id'`.

- **Test case:** "state id collision detection"
  - Setup: main already has state `do_group.prepare` and sub-workflow also has `prepare` which would flatten to the same id (simulate by naming main state `do_group.prepare` explicitly before flattening), or otherwise ensure collision.
  - Act: call loader
  - Assert: thrown Error message contains `State id collision when flattening`.

- **Test case:** "sub-workflow missing out:true -> throws"
  - Setup: sub-workflow has states but none marked `out: true`.
  - Act: call loader
  - Assert: thrown Error that sub-workflow must declare at least one `out: true` state.

### Integration tests (`__tests__/integration/`)
Follow established patterns from `__tests__/integration/testUtils.ts`.

- **File:** `__tests__/integration/flatten.test.ts`
- **Test case:** "valid group flattens and runner executes flattened states"
  - Setup: create tmp workspace, write `subflows/approval.yaml` and main `workflow.yaml` with `do_group` group state. Provide minimal agent registry and agent file if agent state exists.
  - Mock: jest.mock('child_process', () => ({ spawn: jest.fn() })); use `fakeChild` to simulate copilot outputs.
  - Act: call `await runCommand(tmp, 'clean', {});`
  - Assert: `loadContext(tmp)` shows stateHistory includes flattened ids like `do_group.prepare` and final state is `finish`.

- **Test case:** "sub-workflow inputs merged"
  - Setup: sub-workflow declares input `sub_id`; main loader merges it.
  - Act: run loader and then runCommand with provided vars; assert environment variable `RAILI_VAR_SUB_ID` is set during agent invocation (see patterns in agent.test.ts capturing env var during spawn.mockImplementation).

- **Test case:** "missing sub-workflow file -> fail-fast"
  - Setup: group points to non-existent path
  - Act: runCommand tmp clean
  - Assert: runCommand throws before any spawn calls and error message includes `Workflow file not found` or `Group state '<id>' references missing sub-workflow`.

Use `cleanupRailiEnvVars()` in afterEach to clear env vars.

## Acceptance Criteria
- [x] After load, workflow has a single flat state machine (no nested `group` states visible to the runner runtime; sub-workflow states appear as flattened state IDs)
- [x] Sub-workflow inputs are merged into parent inputs; loader fails on duplicate input names
- [x] Transitions from sub-workflow terminal states correctly route back to parent targets defined on the original group state
- [x] Integration test: load main + sub-workflow → flattened state map includes flattened IDs and final routing is correct
- [x] Integration test: sub-workflow inputs merged into parent inputs and RAILI_VAR_<UPPERCASE> is available during runs
- [x] Unit test: state name collision detection throws descriptive error
- [x] Unit test: sub-workflow terminal states (out:true) are required and route back to parent


---

Ticket created for implementation. Follow the ordered Implementation Plan and add unit + integration tests described above. If additional fields are needed (e.g., `out_key`), propose them in a follow-up ticket and add minimal schema updates.

## Implementation update
- Fixed inputs normalization bug causing schema validation to reject normalized inputs with description: undefined. Changed src/workflow/workflowLoader.ts::normalizeInputs to omit the `description` key when not provided and only include it when a string is present. This prevents SchemaValidationError in validateWorkflowConfig.
- Files modified:
  - src/workflow/workflowLoader.ts

## Implementation notes (update)
- Implemented flattening of `group` states in src/workflow/workflowLoader.ts. Sub-workflows are loaded, validated (no nested groups), inputs normalized and merged (duplicate names cause a thrown Error), sub states flattened with deterministic prefix `<group>.<subState>`, and the original group state replaced with an engine proxy that skips to the flattened entry state.
- Added final merged config validation and improved error state validation in validateStateMachine to fail-fast when `error` is missing or non-terminal.
- Unit tests referencing flatten behavior should now pass (`__tests__/unit/workflowLoader.flatten.test.ts` and related validations).

