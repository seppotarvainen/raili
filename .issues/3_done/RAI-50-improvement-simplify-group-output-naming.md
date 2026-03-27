# RAI-50: Simplify group output naming

**Type:** improvement

## Description
Change how outputs produced by sub-workflows (group states) are persisted. Currently sub-states running inside a group are saved to files named <parent>.<substate>.md (e.g. `groupx.produce.md`). This is redundant and complicates downstream consumption of outputs. Persist group sub-state outputs using the sub-state name only (`<state>.md`) — matching how top-level states are stored. Backwards compatibility is intentionally not supported; remove the old parent-prefixed naming.

## Documentation References
- documentation/output.md
- documentation/groups.md

## Code References
- src/context/outputStore.ts (outputPath, saveOutput, loadAgentOutputPath, readLatestRun)
- src/runner/groupStateRunner.ts (runGroupState)
- src/runner/agentStateRunner.ts (AgentStateRunner.run)
- src/runner/stateRunnerUtils.ts (helper usage of saveOutput)
- __tests__/integration/group.integration.test.ts (integration assertions expecting filename)

## Implementation Plan
Ordered steps to implement the change and update tests and docs.

1. **src/context/outputStore.ts** — Modify `outputPath()` to derive the on-disk filename from the final segment of the state id (i.e., if stateId contains dots, use the substring after the last dot). Ensure all helper functions (`saveOutput`, `loadAgentOutputPath`, `readLatestRun`, `clearAgentOutputs`) use `outputPath()` so behavior is consistent.

2. **src/runner/agentStateRunner.ts** — No functional change required if `saveOutput()` continues to be called with `state.id`; confirm tests still pass and remove any code comments implying parent-prefixed filenames.

3. **src/runner/stateRunnerUtils.ts** — No change expected beyond relying on `saveOutput()` behavior.

4. **__tests__/integration/group.integration.test.ts** — Update expectations that asserted the parent-prefixed filename (e.g., `groupx.produce.md`) to expect the new filename (`produce.md`). Update any comments describing storage naming.

5. **documentation/output.md** — Add a short note describing that outputs from sub-workflows are stored by sub-state name (no parent prefix) to avoid confusion.

6. Run repository tests (`npm test`) and fix any regressions found. Update any additional tests that referenced the old naming convention.

7. Commit changes with message: "RAI-50: Simplify group output naming — persist sub-state outputs as <state>.md" and include Co-authored-by trailer.

## Examples

### Before (old filename)
- Group state `groupx` with sub-state `produce` wrote file:
  - `.raili/main/outputs/groupx.produce.md`

### After (new filename)
- Same group/sub-state now writes:
  - `.raili/main/outputs/produce.md`

### Before/After code snippet (conceptual)
Before (what callers saw):
```ts
// agentStateRunner saved using state.id e.g. "groupx.produce"
saveOutput(cwd, state.id, combined, state.config.output, workflowArg);
// outputStore formed path: `${stateId}.md` => groupx.produce.md
```

After (same caller code, storage logic changed):
```ts
// Caller unchanged; outputStore now uses final segment as filename
saveOutput(cwd, state.id, combined, state.config.output, workflowArg);
// outputStore forms filename using last segment => produce.md
```

### Example workflow YAML
```yaml
states:
  groupx:
    type: group
    group: ./sub.yaml

# sub.yaml
states:
  produce:
    type: agent
    agent: test_agent
    output:
      store: true
```

Expected on-disk file: `.raili/main/outputs/produce.md`

## Test Plan

### Unit tests (`__tests__/unit/`)
- **File:** `__tests__/unit/outputStore.test.ts` (new)
- **Test case:** "outputPath strips parent prefix for group sub-state ids"
  - Setup: call `outputPath()` (exported helper via module) with synthetic cwd mocked to point to a temp .raili/main and state ids `group.sub` and `plain`.
  - Act: read returned path strings.
  - Assert: returned basename equals `sub.md` for `group.sub` and `plain.md` for `plain`.

- **File:** `__tests__/unit/outputStore.test.ts`
- **Test case:** "saveOutput/readLatestRun/loadAgentOutputPath use canonical filename"
  - Setup: temporary workspace created via test utils; create .raili/main/outputs dir.
  - Act: call `saveOutput()` for state id `group.produce` with sample content and then call `readLatestRun()` / `loadAgentOutputPath()`.
  - Assert: `readLatestRun()` returns expected content and path from `loadAgentOutputPath()` ends with `produce.md`.

### Integration tests (`__tests__/integration/`)
Follow existing patterns from `__tests__/integration/testUtils.ts`.

- **File:** `__tests__/integration/group.integration.test.ts` (already present — update expectations)
- **Test case:** "sub-workflow outputs are stored under sub-state filename"
  - Setup: use existing test that writes a workflow with a group and a sub-workflow where `produce` sets `output.store: true`.
  - Mock: `jest.mock('child_process', () => ({ spawn: jest.fn() }));` and `spawn.mockImplementation(() => fakeChild('stored output\nsome content', '', 0));`
  - Act: `await runCommand(tmp, 'clean', {});`
  - Assert: `fs.existsSync(path.join(tmp, '.raili', 'main', 'outputs', 'produce.md'))` is true and file contains `stored output`.

- **Additional integration tests**: ensure resumption and other group behaviors unchanged (no changes to sub-state ids in context history). Existing tests should still assert stateHistory entries containing `groupx.produce` etc; leaving those unchanged is fine because virtual state ids still include parent prefix in context/history, only on-disk filenames change.

## Acceptance Criteria
- [x] Output files written for group sub-states are named `<substate>.md` (no parent prefix) in `.raili/<workflow>/outputs/`.
- [x] `saveOutput()`, `loadAgentOutputPath()`, `readLatestRun()`, and `clearAgentOutputs()` consistently use the new naming rule.
- [x] Integration test updated: `__tests__/integration/group.integration.test.ts` expects `produce.md` rather than `groupx.produce.md` and passes.
- [x] No other tests break; repository test suite passes locally.



---

**Ticket created:** ID RAI-50 — improvement — simplify-group-output-naming

Saved to: .issues/1_todo/RAI-50-improvement-simplify-group-output-naming.md
