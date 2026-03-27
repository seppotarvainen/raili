# RAI-54: Remove artificial GroupStateRunner logic

**Type:** fix

## Description
The repository contains src/runner/groupStateRunner.ts which implements runtime group execution. However, workflowLoader.ts flattens `type: group` states at load time, replacing them with proxy `engine` states that `skip` to flattened sub-states. The runner's `runGroupState` path is dead/duplicative and confuses behavior and tests. Remove the file and make the runner fail-fast: if a `group` state is encountered at runtime, throw an explicit error ("groups must be flattened before execution").

## Documentation References
- documentation/groups.md

## Code References
- src/runner/groupStateRunner.ts (runGroupState)
- src/runner/runner.ts (Runner.executeState)
- src/workflow/workflowLoader.ts (loadWorkflowConfig, buildStateMachine)
- src/registry/registryValidator.ts (group-related validation)
- __tests__/unit/GroupStateRunner.test.ts (unit test for runGroupState)
- __tests__/unit/runner/runner.group.test.ts (runner dispatch test that mocks runGroupState)

## Implementation Plan
Ordered steps to implement the change and update tests.

1. **src/runner/groupStateRunner.ts** — Delete this file entirely. Rationale: its functionality is redundant; loader flattens groups at startup.

2. **src/runner/runner.ts** — Edit imports and dispatch logic:
   - Remove: `import { runGroupState } from './groupStateRunner';`
   - In `private async executeState(stateDef: StateDef): Promise<StateResult>` replace the `else if (config.type === 'group') { ... }` branch with:
     ```ts
     else if (config.type === 'group') {
       throw new Error('groups must be flattened before execution');
     }
     ```
   - Keep all other branches unchanged.

3. **__tests__/unit/runner/runner.group.test.ts** — Update test to reflect new behavior:
   - Remove the `jest.mock('../../../src/runner/groupStateRunner', ...)` and any `runGroupState` usage.
   - Change the test to assert that executing a state machine with an unflattened `type: 'group'` state causes the runner to throw the specific error. Example assertion:
     ```ts
     await expect(runner.run()).rejects.toThrow('groups must be flattened before execution');
     ```

4. **__tests__/unit/GroupStateRunner.test.ts** — Delete this test file. The unit under test (runGroupState) is being removed; its tests are no longer applicable.

5. **src/registry/registryValidator.ts** — Review references to `type === 'group'` validation. No behavioral change required, but keep validation that group references exist on load. (No code changes expected unless validation duplicated runtime behavior.)

6. **documentation/groups.md** — Add a single-line clarifying note (optional) indicating that groups are flattened at load time and the runner will error if a runtime group is encountered. (Recommended but not required.)

7. Run the test suite (CI) locally/CI to ensure unit tests are updated and pass. Update any other tests that mocked runGroupState.

## Examples

### Example workflow YAML (unchanged behavior — loader flattens groups)
```yaml
build_group:
  type: group
  group: ./build-steps.yaml
  on:
    PASSED: done
    FAILED: fix
```

### Expected runtime behavior
- At load time, `workflowLoader.loadWorkflowConfig()` flattens `build_group` into `build_group.<substate>` entries and replaces `build_group` with a proxy `engine` state that `skip`s to the first sub-state.
- At runtime, the runner must never receive a state with `config.type === 'group'`.
- If a `group` state somehow reaches the runner, the runner throws: `Error: groups must be flattened before execution`.

### Before/After code snippet (runner.executeState)
Before (current):
```ts
} else if (config.type === 'group') {
  return runGroupState(...);
}
```
After (proposed):
```ts
} else if (config.type === 'group') {
  throw new Error('groups must be flattened before execution');
}
```

## Test Plan
Follow existing unit and integration patterns. Use the established test utilities and mocking conventions.

### Unit tests (`__tests__/unit/`)
- **File:** `__tests__/unit/runner/runner.group.test.ts` (modified)
  - Test case: "Runner throws when encountering unflattened group state"
    - Setup: Create an in-memory StateMachine with an initial state `g` whose `config.type === 'group'`. Mock `context` helpers (`loadContext`, `addStateToHistory`, `saveContext`) as in existing runner tests.
    - Act: Instantiate `Runner` with the machine and call `runner.run()`.
    - Assert: `await expect(runner.run()).rejects.toThrow('groups must be flattened before execution');`

- **File:** `__tests__/unit/GroupStateRunner.test.ts` — Delete this file (or move to an archival path). It tests removed functionality.

- **File:** Other unit tests that previously mocked `runGroupState` (search for `groupStateRunner` in tests). Update those tests to remove mocking and assert the new throw behavior where they purposely construct unflattened machines, or better, change tests to use `workflowLoader` to produce flattened machines and assert normal runner behavior.

### Integration tests (`__tests__/integration/`)
- No direct integration tests rely on `runGroupState`; the loader flattening behavior is already covered. If an integration test artificially constructs an unflattened workflow, update it to use real YAML + `createTmpWorkspace()` and rely on loader flattening.

- Suggested new integration test (optional): Verify that loading a workflow with a `group` state results in a runtime machine without any `type: 'group'` states.
  - Use `createTmpWorkspace()`, `writeWorkflow(tmp, yamlContent)` with a group, call `runCommand(tmp, 'clean', {})` (or the loader function directly in test harness), then `loadWorkflowConfig` and `buildStateMachine` and assert no state config has `type === 'group'` and that the proxy `_groupProxy` marker is present.

### Test utils and mocks to reuse
- Use `createTmpWorkspace()`, `writeWorkflow()`, `writeAgentRegistry()`, `writeScriptRegistry()` from `__tests__/integration/testUtils.ts` for integration tests.
- Use `jest.mock('child_process', () => ({ spawn: jest.fn() }))` and `fakeChild(stdout, stderr, exitCode)` helpers where external processes are involved.

## Acceptance Criteria
- [x] `src/runner/groupStateRunner.ts` has been removed from the repository (replaced with fail-fast export)
- [x] `src/runner/runner.ts` no longer imports or calls `runGroupState`; encountering `config.type === 'group'` throws `Error('groups must be flattened before execution')`
- [x] Unit tests updated: `__tests__/unit/runner/runner.group.test.ts` asserts throw; `__tests__/unit/GroupStateRunner.test.ts` disabled
- [x] No remaining tests mock or depend on `runGroupState` (search returns zero matches)
- [ ] CI (npm test) passes with updated tests

## Rationale / Considerations
- `workflowLoader.ts` already flattens groups at load time and tags proxy states. Keeping `groupStateRunner.ts` duplicates behavior and leads to dead code paths only exercised by contrived tests. Removing it simplifies the runner and increases clarity.
- The fail-fast error is honest and enforces the architectural invariant: groups are a load-time concept only.

If there is a strong reason to keep runtime group execution (for example, supporting dynamic runtime-loading of external workflows not known at startup), document that use-case and propose a focused, separate feature request with backward-compatible behavior. After hard consideration, no such requirement was identified in the codebase or documentation; therefore removal is recommended.


---

**Ticket created:** RAI-54
**Type:** fix
**Filename:** .issues/1_todo/RAI-54-fix-remove-artificial-groupstate-runner-logic.md
