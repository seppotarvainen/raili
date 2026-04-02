# RAI-59: Add option to use multiple stored outputs in agent input

**Type:** improvement

## Description
Currently, when an agent state has `output.store` enabled, only the latest run's output is injected into the agent's prompt on the next invocation. This improvement adds an optional `use_latest` field to `OutputConfig` that allows users to control how many stored output runs to inject. The default behavior (when `use_latest` is omitted) is to inject **all** stored outputs. This enables more comprehensive context-aware agent iteration, especially when combined with marker-based extraction (`marker` and `marker_end`) and tail filtering.

## Documentation References
- documentation/output.md

## Code References
- src/types.ts (OutputConfig interface)
- src/workflow/schemas.ts (OutputConfigSchema)
- src/context/outputStore.ts (readLatestRun, loadAgentOutputPath functions)
- src/handlers/agentHandler.ts (executeAgent function)
- src/runner/agentStateRunner.ts (AgentStateRunner class)

## Implementation Plan

### Phase 1: Schema & Types

1. **src/types.ts** — Add optional `use_latest?: number` field to `OutputConfig` interface
   - Type: `number` (must be > 0 if provided)
   - Optional
   - Semantics: "Number of latest runs to inject into agent prompt; if omitted, use all"

2. **src/workflow/schemas.ts** — Add `use_latest` field definition to `OutputConfigSchema`
   - Type: `number`
   - Required: `false`
   - Description: "Number of latest runs to inject (omit to use all)"

### Phase 2: Output Store Functions

3. **src/context/outputStore.ts** — Add new function `readLatestNRuns(cwd, stateId, n, workflowArg?)`
   - Parse the file (same structure as `readLatestRun`)
   - Extract the latest N runs (where N = n parameter, or all if n is undefined/null)
   - Concatenate them in chronological order (oldest first)
   - Return the concatenated string
   - Behavior:
     - If n is undefined or null: return all runs concatenated
     - If n <= 0: return empty string (or null)
     - If file has fewer than n runs: return all available runs
     - Include run separators (`--- Run ...`) in the output to preserve historical boundaries
     - Return null if no file exists

### Phase 3: Agent Handler Update

4. **src/handlers/agentHandler.ts** — Modify `executeAgent()` function signature and logic
   - Add new parameter `useLatest?: number` (passed after `previousOutputPath`)
   - When reading output history:
     - If `useLatest` is defined and > 0: call `readLatestNRuns(cwd, stateId, useLatest)` 
     - If `useLatest` is undefined: call `readLatestNRuns(cwd, stateId)` (get all)
     - Preserve the existing logic: append to prompt with `\n\nYour previous output(s):\n{history}`

### Phase 4: Agent State Runner Update

5. **src/runner/agentStateRunner.ts** — Modify `AgentStateRunner.run()` method
   - Extract `use_latest` from `state.config.output?.use_latest`
   - Pass it to `executeAgent()` as the new parameter
   - All other logic remains unchanged

## Examples

### Example 1: Use all stored outputs (default behavior)
```yaml
my_agent:
  type: agent
  agent: some-agent
  prompt: "Analyze this code"
  output:
    store: true
    marker: "//SUMMARY//"
    marker_end: "//END_SUMMARY//"
  continue: next_step
```

When run 3 times, the agent will receive all 3 summarized outputs concatenated into its prompt.

### Example 2: Use only latest 5 runs
```yaml
my_agent:
  type: agent
  agent: some-agent
  prompt: "Continue analysis"
  output:
    store: true
    use_latest: 5
    tail: 100
  continue: next_step
```

On the 10th run, only the last 5 runs' outputs (each with last 100 lines) are concatenated and injected.

### Example 3: Use only latest 1 run (equivalent to current behavior)
```yaml
my_agent:
  type: agent
  agent: some-agent
  prompt: "Refine the solution"
  output:
    store: true
    use_latest: 1
  transitions:
    approve: done
    reject: rework
```

Only the immediately preceding run is injected, matching current behavior for users who want bounded context.

### Expected behavior / output

**Stored output file structure (unchanged):**
```
summary 1

--- Run 2026-04-02T05:38:24.311Z ---

summary 2

--- Run 2026-04-02T05:39:30.100Z ---

summary 3
```

**Agent prompt with use_latest: 2:**
```
Analyze this code

Your previous output(s):
--- Run 2026-04-02T05:38:24.311Z ---

summary 2

--- Run 2026-04-02T05:39:30.100Z ---

summary 3
```

**Agent prompt with use_latest omitted (all):**
```
Analyze this code

Your previous output(s):
summary 1

--- Run 2026-04-02T05:38:24.311Z ---

summary 2

--- Run 2026-04-02T05:39:30.100Z ---

summary 3
```

## Test Plan

### Unit tests (`__tests__/unit/`)

#### Test file: `__tests__/unit/context/outputStore.multipleRuns.test.ts`

**Test case 1:** "readLatestNRuns returns null when file doesn't exist"
- Setup: No output file created
- Act: Call `readLatestNRuns(cwd, 'nonexistent', 3)`
- Assert: Returns `null`

**Test case 2:** "readLatestNRuns returns all runs when n is undefined"
- Setup: Create output file with 3 runs separated by markers
- Act: Call `readLatestNRuns(cwd, 'teststate', undefined)`
- Assert: Returns concatenated string with all 3 runs including separators

**Test case 3:** "readLatestNRuns returns all runs when n is null"
- Setup: Create output file with 3 runs
- Act: Call `readLatestNRuns(cwd, 'teststate', null)`
- Assert: Returns concatenated string with all 3 runs

**Test case 4:** "readLatestNRuns returns latest N runs"
- Setup: Create output file with 4 runs
- Act: Call `readLatestNRuns(cwd, 'teststate', 2)`
- Assert: Returns only runs 3 and 4 with separator between them, omits runs 1 and 2

**Test case 5:** "readLatestNRuns returns all available when N exceeds run count"
- Setup: Create output file with 2 runs
- Act: Call `readLatestNRuns(cwd, 'teststate', 5)`
- Assert: Returns all 2 runs

**Test case 6:** "readLatestNRuns returns empty when n is 0 or negative"
- Setup: Create output file with runs
- Act: Call `readLatestNRuns(cwd, 'teststate', 0)` and `readLatestNRuns(cwd, 'teststate', -1)`
- Assert: Both return empty string (or null)

#### Test file: `__tests__/unit/handlers/agentHandler.multipleOutputs.test.ts`

**Test case 7:** "executeAgent injects all outputs when useLatest is undefined"
- Setup: Mock `readLatestNRuns` to return "output1\noutput2\noutput3"; mock fs to have output file
- Act: Call `executeAgent(registry, agentId, cwd, outputPath, prompt, undefined)`
- Assert: Spawn called with prompt containing all concatenated outputs

**Test case 8:** "executeAgent injects only latest N outputs when useLatest is defined"
- Setup: Mock `readLatestNRuns` to return "output2\noutput3" for n=2
- Act: Call `executeAgent(registry, agentId, cwd, outputPath, prompt, 2)`
- Assert: Spawn called with prompt containing only outputs 2 and 3

#### Test file: `__tests__/unit/runner/agentStateRunner.multipleOutputs.test.ts`

**Test case 9:** "AgentStateRunner passes use_latest to executeAgent"
- Setup: Create StateDef with output config containing `use_latest: 3`; mock executeAgent
- Act: Call `runner.run(state, cwd, vars)`
- Assert: executeAgent called with `useLatest: 3`

**Test case 10:** "AgentStateRunner calls executeAgent with undefined when use_latest omitted"
- Setup: Create StateDef with output config but no `use_latest` field; mock executeAgent
- Act: Call `runner.run(state, cwd, vars)`
- Assert: executeAgent called with `useLatest: undefined`

### Integration tests (`__tests__/integration/`)

#### Test file: `__tests__/integration/multipleOutputs.test.ts`

**Test case 11:** "Agent receives all stored outputs by default across multiple runs"
```typescript
// Workflow definition with 3 agent runs, each storing output
writeWorkflow(tmp, `
initial: run1
states:
  run1:
    type: agent
    agent: test_agent
    prompt: "First run"
    output:
      store: true
    transitions:
      continue: run2
  run2:
    type: agent
    agent: test_agent
    prompt: "Second run"
    output:
      store: true
    transitions:
      continue: run3
  run3:
    type: agent
    agent: test_agent
    prompt: "Third run, analyze all previous outputs"
    output:
      store: true
    transitions:
      done: done
  done:
    type: engine
`);
writeAgentRegistry(tmp, { test_agent: { path: './agents/test.agent.md' } });
writeAgentFile(tmp, 'agents/test.agent.md', 'Agent instructions');

// Mock copilot to return different outputs per run
spawn.mockImplementation((cmd: string) => {
  if (cmd === 'copilot') {
    const callCount = spawn.mock.calls.filter((c: any[]) => c[0] === 'copilot').length;
    if (callCount === 1) return fakeChild('Analysis 1\ncontinue', '', 0);
    if (callCount === 2) return fakeChild('Analysis 2\ncontinue', '', 0);
    if (callCount === 3) return fakeChild('Analysis 3\ndone', '', 0);
  }
  return fakeChild('', '', 0);
});

await runCommand(tmp, 'clean', {});

// Assert: run3 agent receives all 3 previous outputs in prompt
const run3Call = spawn.mock.calls.filter((c: any[]) => c[0] === 'copilot')[2];
expect(run3Call[1][2] /* prompt arg */).toContain('Your previous output(s)');
expect(run3Call[1][2]).toContain('Analysis 1');
expect(run3Call[1][2]).toContain('Analysis 2');
expect(run3Call[1][2]).toContain('--- Run'); // Separators preserved

// Assert: context reflects terminal state
const ctx = loadContext(tmp);
expect(ctx.stateHistory[ctx.stateHistory.length - 1].state).toBe('done');
```

**Test case 12:** "Agent receives only latest N outputs when use_latest is set"
```typescript
// Similar workflow but with use_latest: 2
writeWorkflow(tmp, `
initial: run1
states:
  run1:
    type: agent
    agent: test_agent
    prompt: "First"
    output:
      store: true
    transitions:
      continue: run2
  run2:
    type: agent
    agent: test_agent
    prompt: "Second"
    output:
      store: true
    transitions:
      continue: run3
  run3:
    type: agent
    agent: test_agent
    prompt: "Third"
    output:
      store: true
    transitions:
      continue: run4
  run4:
    type: agent
    agent: test_agent
    prompt: "Fourth run, use only latest 2"
    output:
      store: true
      use_latest: 2
    transitions:
      done: done
  done:
    type: engine
`);
// ... write registry, set up mocks ...

await runCommand(tmp, 'clean', {});

// Assert: run4 agent receives ONLY outputs 2 and 3, NOT output 1
const run4Call = spawn.mock.calls.filter((c: any[]) => c[0] === 'copilot')[3];
const promptArg = run4Call[1][2];
expect(promptArg).toContain('Your previous output(s)');
expect(promptArg).toContain('Analysis 2');
expect(promptArg).toContain('Analysis 3');
expect(promptArg).not.toContain('Analysis 1'); // Run 1 should not appear
```

**Test case 13:** "use_latest works with markers and tail filtering"
```typescript
// Workflow with marker-based extraction + use_latest
writeWorkflow(tmp, `
initial: run1
states:
  run1:
    type: agent
    agent: test_agent
    prompt: "Generate summary"
    output:
      store: true
      marker: "//SUMMARY//"
      marker_end: "//END_SUMMARY//"
    transitions:
      continue: run2
  run2:
    type: agent
    agent: test_agent
    prompt: "Generate summary"
    output:
      store: true
      marker: "//SUMMARY//"
      marker_end: "//END_SUMMARY//"
      use_latest: 1
    transitions:
      done: done
  done:
    type: engine
`);
// ... setup ...

spawn.mockImplementation((cmd: string) => {
  if (cmd === 'copilot') {
    const count = spawn.mock.calls.filter((c: any[]) => c[0] === 'copilot').length;
    if (count === 1) return fakeChild('noise\n//SUMMARY//Summary 1//END_SUMMARY//more noise', '', 0);
    if (count === 2) return fakeChild('noise\n//SUMMARY//Summary 2//END_SUMMARY//more noise', '', 0);
  }
  return fakeChild('', '', 0);
});

await runCommand(tmp, 'clean', {});

// Assert: run2 receives only 'Summary 1' (latest 1 run, marker-extracted)
const run2Call = spawn.mock.calls.filter((c: any[]) => c[0] === 'copilot')[1];
const promptArg = run2Call[1][2];
expect(promptArg).toContain('Summary 1');
expect(promptArg).not.toContain('Summary 2');
expect(promptArg).not.toContain('//SUMMARY//'); // Markers already extracted
```

## Acceptance Criteria
- [ ] `OutputConfig` TypeScript interface includes optional `use_latest?: number` field
- [ ] `OutputConfigSchema` in `schemas.ts` includes `use_latest` field definition
- [ ] New function `readLatestNRuns(cwd, stateId, n?, workflowArg?)` implemented in `outputStore.ts` with documented behavior
- [ ] `executeAgent()` in `agentHandler.ts` accepts `useLatest?: number` parameter and passes it to output reading logic
- [ ] `AgentStateRunner.run()` extracts `use_latest` from state config and passes it to `executeAgent()`
- [ ] All 10 unit tests pass (outputStore, agentHandler, agentStateRunner)
- [ ] All 3 integration tests pass (multiple outputs across runs)
- [ ] Default behavior (omitting `use_latest`) injects all stored outputs
- [ ] Explicit `use_latest: N` injects only latest N runs
- [ ] `use_latest` works correctly with marker-based filtering and tail
- [ ] Documentation in `documentation/output.md` updated with `use_latest` examples and semantics
