# RAI-73: Add default variable `workflow` that is injected automatically

**Type:** improvement

## Description
Add automatic injection of a `workflow` variable that contains the current workflow name (e.g., "main", "dev"). This variable should be available like any other declared input without requiring explicit declaration, allowing workflows to dynamically construct output paths and reference their own configuration. The variable is injected during context initialization and available in all variable interpolation contexts (YAML, shell environment, etc.).

## Documentation References
- documentation/variables.md

## Code References
- src/run.ts (runCommand – where context is initialized)
- src/context/context.ts (initializeContext – variable initialization)
- src/variables/variableInterpolation.ts (interpolateString, interpolateObject)
- src/runner/runner.ts (Runner class – has workflowArg)
- src/context/pathUtils.ts (resolveWorkflowDir – determines workflow name from workflowArg)
- __tests__/integration/testUtils.ts (test utilities)

## Implementation Plan

1. **src/run.ts** — Modify `runCommand()` to determine the workflow name and inject it into context.vars before creating the Runner.
   - After determining `workflowPath` (or defaulting to "main" if not provided), extract the workflow name from the resolved workflow directory
   - Call `resolveWorkflowDir()` to get the absolute path, then extract the final directory name (e.g., `path.basename()`)
   - Inject `workflow: <name>` into `context.vars` before passing context to the Runner
   - Ensure this is done for both clean and continue runs

2. **src/context/pathUtils.ts** — Add a helper function to extract the workflow name from workflowArg.
   - Create `getWorkflowName(cwd: string, workflowArg?: string): string`
   - Returns the canonical workflow directory name without path separators (e.g., "main", "dev")
   - This centralizes the name resolution logic and allows reuse

3. **__tests__/integration/agent.test.ts** (or create a new test) — Add integration test to verify the `workflow` variable is injected and available.
   - Create test case: "workflow variable is automatically injected and available in prompts"
   - Create test case: "workflow variable is available as RAILI_VAR_WORKFLOW in shell"
   - Verify the variable is persisted in context.json

4. **__tests__/unit/variableInterpolation.test.ts** (if exists) or **__tests__/unit/run.test.ts** — Add unit tests to verify context initialization includes the workflow variable.

## Examples

### Example workflow using the injected `workflow` variable

```yaml
initial: analyze
states:
  analyze:
    type: agent
    agent: analyzer
    prompt: |
      Analyze the code.
      Current workflow: ${workflow}
      Save analysis to: outputs/${workflow}/analysis.md
    transitions:
      approve: done
      reject: done
  done:
    type: engine
```

### Expected behavior

When running `raili run`, the engine will automatically inject the workflow name:

**For clean run with default workflow:**
```bash
raili run --clean --var ticket_id=123
```
- Workflow resolved to: `.raili/main/`
- `${workflow}` → `main`
- `$RAILI_VAR_WORKFLOW` → `main`
- Agent prompt becomes: `Analyze the code. Current workflow: main. Save analysis to: outputs/main/analysis.md`

**For run with named workflow:**
```bash
raili run --clean --workflow dev --var ticket_id=123
```
- Workflow resolved to: `.raili/dev/`
- `${workflow}` → `dev`
- `$RAILI_VAR_WORKFLOW` → `dev`

**Context persistence:**
```json
{
  "vars": {
    "workflow": "main",
    "ticket_id": "123"
  },
  "stateHistory": [...]
}
```

### Shell usage
```yaml
save_output:
  type: command
  command: "mkdir -p outputs/$RAILI_VAR_WORKFLOW && cp result.txt outputs/$RAILI_VAR_WORKFLOW/"
  on:
    PASSED: done
```

## Test Plan

### Unit tests (`__tests__/unit/`)

- **File:** `__tests__/unit/run.test.ts`
- **Test case:** "clean run injects workflow variable for default workflow"
  - Setup: Mock `buildStateMachine`, `validateStateMachine`, `validateAgentRegistry`, etc.; set `mode='clean'`
  - Act: Call `runCommand(cwd, 'clean', {})`
  - Assert: Inspect passed Runner config; verify `context.vars['workflow'] === 'main'`

- **Test case:** "clean run injects workflow variable for named workflow"
  - Setup: Same mocks; `mode='clean'`, `workflowPath='dev'`
  - Act: Call `runCommand(cwd, 'clean', {}, 'dev')`
  - Assert: Inspect Runner config; verify `context.vars['workflow'] === 'dev'`

- **Test case:** "continue run preserves existing workflow variable"
  - Setup: Mock loadContext to return a context with existing vars; `mode='continue'`
  - Act: Call `runCommand(cwd, 'continue', {}, 'main')`
  - Assert: Verify workflow var is set correctly and existing context vars are preserved

### Integration tests (`__tests__/integration/`)

Follow the established patterns from `__tests__/integration/testUtils.ts`:

**Test case:** "workflow variable is automatically injected and available in agent prompts"
```typescript
// Create temp workspace with named workflow
const tmp = createTmpWorkspace();
writeWorkflow(tmp, `
initial: analyze
inputs: []
states:
  analyze:
    type: agent
    agent: test_agent
    prompt: "Workflow is ${workflow}"
    transitions:
      done: done
  done:
    type: engine
`);
writeAgentRegistry(tmp, {
  test_agent: { path: 'agents/test.md' }
});
writeScriptRegistry(tmp, {});
writeAgentFile(tmp, 'agents/test.md', '# Test Agent\ndone');

// Mock spawn to capture the copilot invocation
spawn.mockImplementation((cmd: string, args: any, opts: any) => {
  if (cmd === 'copilot') {
    // Verify that agent was called with interpolated prompt
    // (assert agent file was read with prompt containing "Workflow is main")
    capturedPrompt = opts?.env?.RAILI_VAR_PROMPT; // or check the agent file read
  }
  return fakeChild('done', '', 0);
});

// Run the workflow
await runCommand(tmp, 'clean', {});

// Assert the context includes workflow variable
const ctx = loadContext(tmp);
expect(ctx.vars['workflow']).toBe('main');
```

**Test case:** "workflow variable is available as RAILI_VAR_WORKFLOW in shell"
```typescript
const tmp = createTmpWorkspace();
writeWorkflow(tmp, `
initial: cmd
states:
  cmd:
    type: command
    command: "echo $RAILI_VAR_WORKFLOW"
    on:
      PASSED: done
  done:
    type: engine
`);
writeAgentRegistry(tmp, {});
writeScriptRegistry(tmp, {});

let capturedEnv: NodeJS.ProcessEnv;
spawn.mockImplementation((cmd: string, args: any, opts: any) => {
  if (cmd === 'sh') {
    capturedEnv = opts?.env;
  }
  return fakeChild('main', '', 0);
});

await runCommand(tmp, 'clean', {});

expect(capturedEnv?.['RAILI_VAR_WORKFLOW']).toBe('main');
```

**Test case:** "workflow variable persists across runs (continue mode)"
```typescript
const tmp = createTmpWorkspace();
writeWorkflow(tmp, `
initial: s1
states:
  s1:
    type: engine
`);
writeAgentRegistry(tmp, {});
writeScriptRegistry(tmp, {});

// First clean run
await runCommand(tmp, 'clean', {});
let ctx = loadContext(tmp);
expect(ctx.vars['workflow']).toBe('main');

// Continue run should preserve it
await runCommand(tmp, 'continue', {});
ctx = loadContext(tmp);
expect(ctx.vars['workflow']).toBe('main');
```

## Acceptance Criteria
- [ ] `getWorkflowName()` helper function added to `src/context/pathUtils.ts` and correctly extracts workflow name from workflowArg
- [ ] `workflow` variable is automatically injected into `context.vars` during context initialization in `src/run.ts` (both clean and continue modes)
- [ ] `workflow` variable is exported as `$RAILI_VAR_WORKFLOW` in the process environment for shell commands and notifications
- [ ] `workflow` variable is available for interpolation in YAML (agent prompts, commands, approval questions)
- [ ] Variable is correctly persisted to `.raili/<workflow>/context.json` and reloaded on `raili run --continue`
- [ ] Integration test verifies workflow variable is injected for default ("main") and named workflows
- [ ] Integration test verifies workflow variable is available in shell context (`$RAILI_VAR_WORKFLOW`)
- [ ] All existing tests pass without modification (backward compatible)
- [ ] No new npm dependencies introduced
