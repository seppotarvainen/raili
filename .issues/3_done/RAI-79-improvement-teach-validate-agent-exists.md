# RAI-79: Update `raili teach` to validate agent existence

**Type:** improvement

## Description
The `raili teach` command and the `teach` field in workflow states currently accept any agent ID without validating that the agent exists in the agent registry. This leads to silent failures where learning files are created for non-existent agents, confusing users and wasting storage. The system should fail-fast with a clear error message when attempting to teach a non-existent agent, consistent with Raili's fail-fast philosophy.

## Documentation References
- documentation/teach.md
- documentation/agents.md

## Code References
- src/cli/teach.ts (teachCommand)
- src/runner/runner.ts (handleTeach)
- src/registry/registryValidator.ts (validateWorkflowReferences, validateAgentRegistry)
- src/registry/agentRegistry.ts (loadAgentRegistry)

## Implementation Plan

1. **src/registry/registryValidator.ts** — Add validation for agents in state `teach` field
   - In `validateWorkflowReferences()`, after validating agent and script state references, add a new section to iterate all states and check the `teach` field
   - For each agentId key in `state.teach`, verify it exists in the `agents` registry
   - Collect errors and throw with a descriptive message listing all missing agents

2. **src/cli/teach.ts** — Add agent registry validation before appending learning
   - Import `loadAgentRegistry` from `src/registry/agentRegistry`
   - At the start of `teachCommand()`, load the agent registry: `const registry = loadAgentRegistry(cwd)`
   - Check if `agentId` exists in registry; if not, throw with message: `Error: Agent '${agentId}' is not defined in agent-registry.json`
   - Ensure this happens before prompting for lesson content (fail-fast)

3. **src/runner/runner.ts** — Add agent validation in `handleTeach()`
   - At the start of `handleTeach()`, before the loop, verify that all agentIds in the `teach` mapping exist in `this.agentRegistry`
   - Collect missing agents and throw a comprehensive error listing them all
   - This ensures workflow execution fails immediately if teach references an invalid agent

4. **__tests__/unit/cli/teach.test.ts** — Add unit test
   - Add test: "throws error when agent not found in registry"
     - Mock `loadAgentRegistry` to return a registry with only `agent1`
     - Call `teachCommand(cwd, 'agent2')` and expect an error containing "not defined"
     - Verify error is thrown before readline interface is even created

5. **__tests__/unit/runner/runner.teach.test.ts** — Add unit test
   - Add test: "handleTeach throws when agent not in registry"
     - Create a runner with a minimal agent registry containing only `agent1`
     - Set up a state with `teach: {agent2: [...]}` 
     - Call `handleTeach()` and expect an error naming `agent2` as missing
     - Verify the error is thrown before any learning store operations

6. **__tests__/integration/teach_cli.test.ts** — Add integration test
   - Add test: "raili teach fails when agent not in registry"
     - Create temp workspace with agent registry containing only `agent1`
     - Set `process.argv` to `['node', 'raili', 'teach', 'agent2']`
     - Mock readline to emit a lesson
     - Call `main()` and expect it to exit with code 1 (failure)
     - Verify the error message mentions the missing agent

7. **__tests__/integration/teach.test.ts** — Add integration test
   - Add test: "workflow teach field fails when agent not in registry"
     - Create temp workspace with workflow containing `teach: {agent2: [{output: ...}]}`
     - Agent registry contains only `agent1`
     - Run `runCommand(tmp, 'clean', {})` and expect validation to throw
     - Verify error mentions agent and teach field

## Examples

### Example 1: CLI teach with missing agent
```bash
raili teach nonexistent_agent
```

**Current behavior:** Prompts for lesson content, then silently creates `.raili/learnings/nonexistent_agent.md`

**Expected behavior:** Immediately prints error:
```
Error: Agent 'nonexistent_agent' is not defined in agent-registry.json
```

### Example 2: Workflow teach field with missing agent
```yaml
initial: start
states:
  analyze:
    type: script
    script: run_test
    teach:
      unknown_agent:
        - output: test_output
    on:
      PASSED: done
  done:
    type: engine
```

With agent registry containing only `{analyzer: {...}}`:

**Current behavior:** Workflow runs, creates learning file for `unknown_agent`

**Expected behavior:** Workflow fails at load/validation time:
```
Workflow validation failed:
  - State 'analyze': teach references agent 'unknown_agent' which is not defined in agent-registry.json

Please ensure all referenced agents are defined in agent-registry.json.
```

### Example 3: Valid teach usage (unchanged)
```yaml
initial: start
states:
  test:
    type: script
    script: run_test
    teach:
      analyzer:
        - output: test_results
    on:
      PASSED: done
  done:
    type: engine
```

With agent registry containing `{analyzer: {path: "agents/analyzer.md"}}`:

**Expected behavior:** Workflow runs normally, creates learning file for valid agent `analyzer`

## Test Plan

### Unit tests (`__tests__/unit/`)

**File:** `__tests__/unit/cli/teach.test.ts`

- **Test case:** "throws error when agent not found in registry"
  - Setup: 
    ```typescript
    jest.mock('../../../src/registry/agentRegistry', () => ({
      loadAgentRegistry: jest.fn().mockReturnValue({ agent1: {} })
    }));
    ```
  - Act: `await teachCommand(cwd, 'agent2')`
  - Assert: Error thrown with message containing "not defined" and "agent2"

**File:** `__tests__/unit/runner/runner.teach.test.ts`

- **Test case:** "handleTeach throws when agent not in registry"
  - Setup:
    ```typescript
    const runner = new Runner({
      workflow: {...},
      agentRegistry: { agent1: {} },
      scriptRegistry: {},
      context: { ... },
      cwd: '.'
    });
    ```
  - Act: Call `runner.handleTeach('state1', {config: {teach: {agent2: [...]}}})`
  - Assert: Error thrown with message containing "agent2"

### Integration tests (`__tests__/integration/`)

**File:** `__tests__/integration/teach_cli.test.ts`

- **Test case:** "raili teach fails when agent not in registry"
  ```typescript
  // Create workspace with registry containing only agent1
  const tmp = createTmpWorkspace();
  writeAgentRegistry(tmp, { 
    agent1: { path: '.github/agents/agent1.md' } 
  });
  writeAgentFile(tmp, 'agent1.md', 'some content');

  // Try to teach nonexistent agent
  process.argv = ['node', 'raili', 'teach', 'agent2'];
  process.chdir(tmp);

  // Mock readline to emit lesson
  (readline.createInterface as jest.Mock).mockImplementation(() => {
    const rl = new EventEmitter();
    (rl as any).close = () => rl.emit('close');
    setImmediate(() => {
      rl.emit('line', 'lesson content');
      rl.emit('line', '/q');
    });
    return rl as any;
  });

  // Execute and expect exit(1)
  try {
    await main();
    fail('Expected process.exit(1)');
  } catch (err) {
    expect(String(err)).toMatch(/agent2|not defined/i);
  }
  ```

**File:** `__tests__/integration/teach.test.ts`

- **Test case:** "workflow teach field validates agent exists before execution"
  ```typescript
  const tmp = createTmpWorkspace();
  
  // Agent registry with only agent1
  writeAgentRegistry(tmp, {
    agent1: { path: '.github/agents/agent1.md' }
  });
  
  // Workflow teach field references nonexistent agent2
  writeWorkflow(tmp, `
initial: s1
states:
  s1:
    type: script
    script: test_script
    teach:
      agent2:
        - output: s1_output
    on:
      PASSED: done
  done:
    type: engine
`);

  writeScriptRegistry(tmp, {
    test_script: { path: 'scripts/test.sh' }
  });

  // Mock shell to succeed
  spawn.mockImplementation(() => fakeChild('', '', 0));

  // Expect validation to throw before execution
  expect(() => {
    runCommand(tmp, 'clean', {});
  }).toThrow(/teach.*agent2|not defined/i);
  ```

## Acceptance Criteria

- [ ] `raili teach <agentId>` fails with error when agentId not in agent registry
- [ ] Error message clearly states agent is not defined and mentions agent-registry.json
- [ ] Workflow teach field validation added to `validateWorkflowReferences()`
- [ ] Workflow execution fails at validation time (before state execution) if teach references missing agent
- [ ] Unit tests added for both CLI and runner teach validation paths
- [ ] Integration tests verify fail-fast behavior and error messages
- [ ] Existing valid teach workflows continue to work without changes
- [ ] No backward compatibility concerns (single user)
