# RAI-45: Ensure flattened state machine outputs and context persist correctly

**Type:** improvement

## Description
Implement shared (flattened) persistence for outputs, learnings and context across group workflows so that parent and included sub-workflow states write to a single outputs/ and learnings/ directory and the context.stateHistory is a flattened, sequential log. This makes resuming mid-sub-workflow deterministic and simplifies memory management.

## Documentation References
- documentation: docs/workflow-yaml.md

## Code References
- src/context/outputStore.ts (filterOutput, saveOutput, readLatestRun, clearAgentOutputs, clearAllOutputs)
- src/context/learningStore.ts (appendUniqueLearning, appendManualLearning, readLearningsForPrompt)
- src/context/context.ts (loadContext, saveContext, addStateToHistory, initializeContext, clearContext)
- src/runner/Runner.ts (Runner.enterState, Runner.record, Runner.run, visitCounts handling)
- src/runner/GroupStateRunner.ts (runGroupState) — ensure parent workflowArg flows into sub-workflow execution and output/learning writes
- src/context/pathUtils.ts (resolveWorkflowDir, learningsFilePath)
- __tests__/integration/testUtils.ts (createTmpWorkspace, writeNamedWorkflow helpers)

## Implementation Plan
Ordered steps the coding agent should follow. Read each referenced file before editing and keep changes minimal and focused.

1. **src/context/pathUtils.ts** — Add/confirm a helper `resolveSharedWorkflowDir(cwd: string, workflowArg?: string): string` (or reuse resolveWorkflowDir) documented to return the parent workflow directory used for shared persistence. Ensure learningsFilePath continues to use resolveWorkflowDir but make it clear in comments that `workflowArg` should be the parent workflow name when used from GroupStateRunner.

2. **src/runner/GroupStateRunner.ts** — Modify `runGroupState` so that any nested execution (loading context, saving outputs, appending learnings) is invoked with the parent workflowArg (the group owner). Specifically, when spawning nested state execution or invoking handlers, pass the parent's workflowArg through so calls to saveOutput/readLatestRun/readLearnings use the shared `.raili/<parent>/` directory. If GroupStateRunner currently creates its own workflowArg, replace it with the parent's, or add a parameter to propagated function calls.

3. **src/context/outputStore.ts** — Make explicit that outputs are always written into the resolved workflowDir outputs folder (no subfolder per included workflow). Verify `outputPath()` uses `resolveWorkflowDir(cwd, workflowArg)` and remove any logic that would create subfolders per include. Add unit tests if needed to assert path.isAbsolute and correctness. Add a short comment documenting the new flattened behavior.

4. **src/context/learningStore.ts** — Ensure `learningsFilePath()` (from pathUtils) points to `.raili/<workflow>/learnings/<agentId>.md`. Remove any implicit per-include grouping and document that learnings are stored under the parent workflow directory. Ensure appendUniqueLearning and appendManualLearning create the directory and write files exactly as they do today but rely on correct learningsFilePath behavior.

5. **src/context/context.ts** — Adjust `loadContext` and `saveContext` if needed to ensure the `context.json` contains a flattened `stateHistory` (array of StateHistoryEntry for parent + sub-workflow states) and to make resume transparent. Add comments and small validation asserting entries are not nested objects and are sequential. Ensure `addStateToHistory` logic appends states sequentially and that merging meta behavior still works when called multiple times for the same flattened stateId.

6. **src/runner/Runner.ts** — Review resume logic and ensure the `workflowArg` used in runner construction is the parent workflow directory. Add a note in the constructor comment that Runner.context/stateMachine are expected to represent a flattened machine. Ensure `persist()` and `record()` continue to call saveContext with the same workflowArg so persisted context.json is in the shared workflow dir.

7. **Tests: unit and integration** — Add tests as described in Test Plan below. Modify any existing integration helpers only in tests (not production code) to create a group/sub-workflow scenario and assert flattened persistence.

8. **Documentation update** — Update docs/workflow-yaml.md where `include:` behavior and outputs/learnings location are described: add a short paragraph describing flattened storage (no per-include subfolders) and resumability from any state.

## Examples

### Example workflow YAML (main + included deploy.yaml)
```yaml
initial: start
include:
  - deploy.yaml

states:
  start:
    type: engine
    on:
      PASSED: deploy

  group_step:
    type: group
    # ...group config that runs states from included file
```

deploy.yaml (sub-workflow):
```yaml
states:
  deploy:
    type: agent
    agent: deploy_agent
    output:
      store: true
    transitions:
      done: done
```

### Expected filesystem
- .raili/main/outputs/start.md
- .raili/main/outputs/deploy.md  <-- output from sub-workflow state appears here
- .raili/main/learnings/deploy_agent.md
- .raili/main/context.json (stateHistory is flattened: ["start","deploy","done"]) 

### Expected context.json excerpt
```json
{
  "stateHistory": [
    { "state": "start", "enteredAt": "..." },
    { "state": "deploy", "enteredAt": "..." },
    { "state": "done", "enteredAt": "..." }
  ],
  "vars": { },
  "approvals": { }
}
```

## Test Plan

### Unit tests (__tests__/unit/)
- **File:** `__tests__/unit/context.outputStore.test.ts`
  - Test case: "saveOutput writes into parent workflow outputs dir"
    - Setup: create tmp workspace via createTmpWorkspace(); call saveOutput(tmp, 'sub_state', 'hello', { store: true }, /* workflowArg */ 'main')
    - Act: call readLatestRun(tmp, 'sub_state', 'main')
    - Assert: returned content contains 'hello' and file exists at `.raili/main/outputs/sub_state.md`

- **File:** `__tests__/unit/context.learningStore.test.ts`
  - Test case: "appendUniqueLearning stores learnings under main learnings dir"
    - Setup: create tmp workspace; call appendUniqueLearning(tmp, 'agentX', 'output\nlesson: important lesson', 'source', 'main')
    - Assert: file `.raili/main/learnings/agentX.md` exists and contains 'important lesson'

- **File:** `__tests__/unit/context.context.test.ts`
  - Test case: "addStateToHistory flattens and preserves meta merges"
    - Setup: start with empty context; call addStateToHistory for 'group', then for 'substate', then add meta to 'group' and verify merged meta merges waitMs sums
    - Assert: context.stateHistory length and entries order reflect appended sequence exactly as called

### Integration tests (__tests__/integration/)
Follow patterns in __tests__/integration/testUtils.ts and agent.test.ts.

- **File:** `__tests__/integration/flattened_persistence.test.ts`
  - Test case 1: "main -> group -> sub-workflow outputs saved in .raili/main/outputs"
    - Setup: createTmpWorkspace(); write main workflow with include: deploy.yaml; writeNamedWorkflow(tmp, 'main', ...) writeNamedWorkflow for included file using writeNamedWorkflow helper or writeWorkflow/ writeNamedWorkflow as needed; register agent deploy_agent; spawn mocked child_process that returns an outcome and content; ensure process runs through group -> sub state
    - Act: runCommand(tmp, 'clean', {});
    - Assert:
      - fs.existsSync(path.join(tmp, '.raili', 'main', 'outputs', 'deploy.md')) === true
      - loadContext(tmp).stateHistory includes 'deploy' between start and done

  - Test case 2: "stop mid-sub-workflow and resume continues from exact sub-workflow state"
    - Setup: start run and intercept after first sub-workflow state (simulate crash by not completing workflow or by stopping before final state), ensure context.json persisted with last entered state being the sub-workflow state
    - Act: re-run runCommand(tmp, 'continue', {}) (or runCommand with context loaded)
    - Assert: Runner resumes and the next executed state is the expected successor of that sub-workflow state

  - Test case 3: "sub-workflow agent learnings persisted to .raili/main/learnings"
    - Setup: agent prints a lesson using 'lesson:' marker; spawn.mockImplementation returns that output; run workflow
    - Assert: file `.raili/main/learnings/<agent>.md` exists and contains the lesson block

Mocking patterns and helpers: use jest.mock('child_process') and fakeChild(stdout, stderr, exitCode) as in existing tests. Use createTmpWorkspace(), writeAgentRegistry(), writeAgentFile(), writeNamedWorkflow()/writeWorkflow() helpers. Clean env vars between tests with cleanupRailiEnvVars().

## Acceptance Criteria
- [x] Outputs and learnings stored in shared directory `.raili/<workflow>/outputs` and `.raili/<workflow>/learnings` (no per-include subfolders)
- [x] Context persists flattened stateHistory containing parent + sub-workflow state entries in order (resumable from any sub-workflow state)
- [ ] `max_visits` on group states counted per entry (not per internal sub-workflow loops)
- [ ] Integration test: run main → group → sub-workflow states → `.raili/main/outputs/` contains outputs for both parent and sub-workflow states
- [ ] Integration test: stop mid-sub-workflow, resume → continues from the correct sub-workflow state
- [ ] Integration test: sub-workflow state with learnings persisted to `.raili/main/learnings/`
- [ ] Unit test: context.json stateHistory includes flattened list of all state entries
- [x] Sub-workflow out:true validation restored (unit test passing)

---

Filename: `.issues/1_todo/RAI-45-improvement-flattened-outputs-context-persistence.md`
