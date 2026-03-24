# RAI-43: Merge and validate variables across main and sub-workflow

**Type:** improvement

## Description
Implement global variable scoping and input merging for parent and sub-workflows so all states share a single context.vars. Merge declared inputs at startup; reject duplicate keys across parent and sub-workflows (fail-fast). Ensure interpolation, interactive collection (clean runs) and resumed runs use the merged vars object.

## Documentation References
- docs/workflow-yaml.md

## Code References
- src/workflow/workflowLoader.ts (loadWorkflowConfig, buildStateMachine)
- src/variables/variableInterpolation.ts (interpolateString, interpolateObject)
- src/run.ts (runCommand)
- src/context/context.ts (loadContext, initializeContext, saveContext)
- src/workflow/schemaValidator.ts (validateWorkflowConfig)
- __tests__/integration/testUtils.ts (createTmpWorkspace, writeWorkflow, fakeChild, cleanupRailiEnvVars)

## Implementation Plan

1. **src/workflow/workflowLoader.ts — loadWorkflowConfig**
   - Ensure merging of parent and sub-workflow inputs occurs exactly once when flattening groups. Keep existing normalizeInputs() usage.
   - Add explicit unit-tested branch that throws on duplicate keys (already present lines 91-100). Add a clearer error message referencing both workflow paths.
   - Add a new helper comment documenting "inputs are merged into WorkflowConfig.inputs and used by runCommand for var collection".

2. **src/variables/variableInterpolation.ts — interpolateString / interpolateObject**
   - Ensure functions accept vars: Record<string,string> and that throwOnMissing default true remains. Add unit tests ensuring interpolation for sub-workflow strings uses merged context.vars.
   - Add a small note in JSDoc that vars should be the global context.vars.

3. **src/run.ts — runCommand**
   - After loadWorkflowConfig(), compute declaredNames from workflowConfig.inputs (this already exists lines 101-111). Ensure declaredNames uses merged inputs from loadWorkflowConfig (no further action if already correct).
   - For clean runs: load vars file using loadVarsFile(cwd, declaredNames, workflowPath) and prompt interactively only for declaredNames not present in fileVars or CLI vars. Add code to prompt each missing input once and save into initialVars before initializeContext.
   - For resume runs: ensure that loadContext returns context.vars that represent previously persisted merged inputs; do not prompt. If additional CLI vars are supplied, merge them into context.vars (already present lines 117-119).
   - After context is prepared, persist env vars RAILI_VAR_* from context.vars (already implemented lines 121-126). Ensure this runs after interactive collection.

4. **src/context/context.ts — loadContext / initializeContext**
   - Confirm initializeContext stores vars as a flat Record<string,string> (already lines 161-167). Ensure loadContext sets parsed.vars = parsed.vars ?? {} (already lines 37-39). Add unit tests for persisted merged vars shape: {vars: {<name>:"value"}}.

5. **src/workflow/schemaValidator.ts — validateWorkflowConfig**
   - Add validation step that all variables referenced in state-level strings (prompts, commands, notify) are declared in workflowConfig.inputs. This requires scanning all string fields in states via variableInterpolation.interpolateObject with throwOnMissing=true against a synthetic vars object keyed by declared input names with dummy values. If a referenced ${VAR} is not present in declared inputs, throw a clear validation error pointing to the state id and missing var.

6. **Tests**
   - Add unit tests and integration tests (details in Test Plan below). Use existing test utils and child_process mocking patterns.

## Examples

### Example workflow YAML
```yaml
initial: start
inputs: [ticket_id]
states:
  start:
    type: group
    group: sub_workflow.yaml
    on:
      PASSED: done

# .raili/sub_workflow.yaml (no initial)
states:
  analyze:
    type: agent
    prompt: "Analyze ticket ${ticket_id} on branch ${branch}"
    transitions:
      approve: "done"
inputs: [branch]
```

### Expected behavior / output
- Startup merges inputs into workflowConfig.inputs: [ticket_id, branch]
- If both main and sub declare `ticket_id`, startup fails with: "Duplicate input key 'ticket_id' found in sub-workflow '<path>' and parent workflow"
- For clean run, user is prompted once for missing inputs (ticket_id and branch); context.vars becomes {ticket_id: "...", branch: "..."} and persisted in .raili/main/context.json
- Sub-workflow state prompt interpolates both variables: "Analyze ticket 123 on branch feature/x"

Before (context.json absent on clean):
- No .raili/main/context.json

After (clean run completed):
.riali/main/context.json {
  "vars": { "ticket_id": "123", "branch": "feature/x" },
  "approvals": {},
  "stateHistory": []
}

## Test Plan

### Unit tests (`__tests__/unit/`)

- **File:** `__tests__/unit/workflowLoader.inputs.test.ts`
  - Test case: "Duplicate input key in parent and sub-workflow -> validation error"
    - Setup: create a temp workflow YAML string with a group state pointing to a sub-workflow YAML (use helper or inline object). Ensure both declare `ticket_id`.
    - Act: call loadWorkflowConfig(tmpDir)
    - Assert: throws Error containing `Duplicate input key 'ticket_id'`

- **File:** `__tests__/unit/variableInterpolation.test.ts`
  - Test case: "interpolateObject uses merged context.vars and throws on missing when throwOnMissing=true"
    - Setup: vars = {A: '1'}
    - Act: interpolateString('Value ${A} ${B}', vars, {throwOnMissing:true})
    - Assert: throws Error referencing variable 'B'

- **File:** `__tests__/unit/schemaValidator.inputs.test.ts`
  - Test case: "state references undeclared variable -> validation error"
    - Setup: build a config where a state.prompt contains ${UNDECLARED}
    - Act: validateWorkflowConfig(config)
    - Assert: throws Error referencing state id and 'UNDECLARED'

### Integration tests (`__tests__/integration/`)

Follow patterns in `__tests__/integration/testUtils.ts`.

- **Test:** "clean run prompts for missing sub-workflow input once and persists shared vars"
  - Setup:
    - const tmp = createTmpWorkspace();
    - writeWorkflow(tmp, main workflow YAML (group state as above));
    - writeNamedWorkflow(tmp, 'sub_workflow.yaml', sub workflow YAML) or write agent files as needed;
    - writeAgentRegistry(tmp, { analyzer: { path: '.github/agents/analyzer.md' } });
    - Mock child_process.spawn to return appropriate fakeChild outputs for agent runs (e.g., 'approve' exit code 0).
  - Act:
    - spawn.mockImplementation(cmd => cmd === 'copilot' ? fakeChild('approve', '', 0) : fakeChild('', '', 0));
    - await runCommand(tmp, 'clean', {});
  - Assert:
    - const ctx = loadContext(tmp);
    - expect(ctx.vars.ticket_id).toBeDefined();
    - expect(ctx.vars.branch).toBeDefined();
    - cleanupRailiEnvVars();

- **Test:** "sub-workflow state uses parent-declared variable"
  - Setup: main inputs include ticket_id; sub workflow references ${ticket_id} in prompt; ensure runCommand('clean') picks ticket_id from vars file or CLI and agent prompt gets interpolated string with that ticket_id (assert spawn called with copilot and that prompt contains the value)

### Mock patterns & notes
- Use jest.mock('child_process', () => ({ spawn: jest.fn() }));
- Use fakeChild(stdout, stderr, exitCode) from testUtils to simulate agent/script outputs
- For non-interactive prompts in tests, set env vars: process.env.RAILI_FEEDBACK_<NAME> or RAILI_MANUAL_CHOICE when necessary

## Acceptance Criteria
- [ ] A single shared context.vars contains merged inputs from parent and sub-workflows for the flattened workflow
- [x] Startup merges declared inputs at loadWorkflowConfig and rejects duplicate keys across parent and sub-workflow (fail-fast)
- [x] Variable interpolation (prompts/commands/notify) resolves variables declared in either parent or sub-workflow (validation added)
- [ ] Integration test: clean run where sub-workflow has an undeclared input prompts once and the collected value is available to both parent and sub states
- [ ] Integration test: sub-workflow state using a parent-declared variable interpolates correctly in agent/script prompts
- [x] Unit test: duplicate input key causes validation error
- [x] Unit test: variable interpolation in sub-workflow state fails when referenced but not declared


---

**Filename:** .issues/1_todo/RAI-43-improvement-merge-validate-variables.md

## Progress Update

Implemented the core validation and merging logic required by this ticket's unit tests. Changes are focused on loading and validating workflows and do not yet add the interactive collection integration tests (those remain on the checklist).

Implemented/modified files:
- src/workflow/workflowLoader.ts — loadWorkflowConfig, buildStateMachine, sub-workflow flattening and duplicate-input detection
- src/workflow/schemaValidator.ts — validateWorkflowConfig, validateStateConfig, undeclared-variable detection via interpolation

Ready for test-agent verification and follow-up integration test implementation.

