# RAI-70: Add file <state>.latest.md automatically when storing outputs

**Type:** improvement

## Description

Currently, when a state has `output.store: true`, Raili appends each run's output to `<stateId>.md` with timestamped separators to maintain full history. However, agents consuming this output must manually restore and filter recent content, which is cumbersome. This improvement automatically maintains a separate `<stateId>.latest.md` file containing only the most recent run's output, making it easier for downstream states to access fresh results without manual filtering.

## Documentation References
- documentation/output.md

## Code References
- src/context/outputStore.ts (saveOutput, filterOutput, outputPath functions)
- src/runner/stateRunnerUtils.ts (storeOutput function)
- src/runner/agentStateRunner.ts (output storage call)
- src/runner/scriptStateRunner.ts (output storage call)
- src/runner/commandStateRunner.ts (output storage call)

## Implementation Plan

1. **src/context/outputStore.ts** — Add `saveLatestOutput()` function to write the filtered output to `<stateId>.latest.md` (overwrite mode, not append). This function should:
   - Accept the same parameters as `saveOutput` (cwd, stateId, output, outputConfig, workflowArg)
   - Apply the same filtering (marker extraction, tail) as the main output
   - Write (not append) to `<stateId>.latest.md`
   - Return early if outputConfig.store is false or filtered output is empty

2. **src/context/outputStore.ts** — Update `saveOutput()` to call `saveLatestOutput()` after successfully saving the timestamped output. Add the call at the end of the function after the existing append logic completes.

3. **src/runner/stateRunnerUtils.ts** — Update `storeOutput()` to call `saveLatestOutput()` alongside `saveOutput()`. Both functions accept the same parameters, so add a second call after the `saveOutput()` call.

4. **__tests__/integration/outputStore.test.ts** — Add integration test case(s) to verify:
   - First run creates both `<stateId>.md` and `<stateId>.latest.md`
   - Second run appends to `<stateId>.md` but overwrites `<stateId>.latest.md`
   - Filtering (marker, tail) is applied identically to both files
   - Empty outputs are not written

5. **__tests__/unit/outputStore.test.ts** — Add unit tests for `saveLatestOutput()`:
   - Verify the function writes to the correct `.latest.md` path
   - Verify filtering is applied (marker extraction, tail)
   - Verify the file is overwritten (not appended) on subsequent calls
   - Verify early return when outputConfig.store is false
   - Verify early return when filtered output is empty

## Examples

### Example workflow YAML
```yaml
states:
  analyze:
    type: agent
    agent: analyzer
    prompt: "Analyze ticket ${ticket_id}"
    output:
      store: true
      marker: "SUMMARY:"
      tail: 100

  review:
    type: agent
    agent: reviewer
    prompt: "Review the analysis in ${ANALYZE_OUTPUT_LATEST}"
    output:
      store: true
```

### Expected behavior / output

**First run of `analyze` state:**
- Creates `.raili/main/outputs/analyze.md` with full filtered output
- Creates `.raili/main/outputs/analyze.latest.md` with the same filtered output
- Both files contain output after "SUMMARY:" marker with tail of 100 lines

**Second run of `analyze` state:**
- Appends to `.raili/main/outputs/analyze.md` with `--- Run <ISO-TIMESTAMP> ---` separator followed by new output
- Overwrites `.raili/main/outputs/analyze.latest.md` with only the new run's filtered output
- `analyze.md` now contains two timestamped runs
- `analyze.latest.md` contains only the most recent output

**File structure on disk:**
```
.raili/main/outputs/
  analyze.md          # Contains all runs with separators (audit trail)
  analyze.latest.md   # Contains only most recent run (easy consumption)
  review.md           # History for review state
  review.latest.md    # Latest review output
```

### Accessing the latest output

Downstream agents can reference the latest output file directly:
```yaml
review:
  type: agent
  agent: reviewer
  prompt: "Review the latest analysis:\n\n$(cat .raili/main/outputs/analyze.latest.md)"
```

Or if using a script to read the file and expose as a variable, then reference via interpolation.

## Test Plan

### Unit tests (`__tests__/unit/outputStore.test.ts`)

- **Test case:** "saveLatestOutput writes to .latest.md path"
  - Setup: Create temp workspace, mock `getFileSystem()` to track file writes
  - Act: Call `saveLatestOutput(cwd, 'mystate', 'filtered content', {store: true})`
  - Assert: Verify `writeFileSync` was called with path ending in `mystate.latest.md` and content matches input

- **Test case:** "saveLatestOutput applies filtering (marker extraction)"
  - Setup: Mock `getFileSystem()`, prepare outputConfig with `marker: "RESULT:"`
  - Act: Call `saveLatestOutput(cwd, 'state1', 'preamble\nRESULT:\nresult content\ntrailing', {store: true, marker: "RESULT:"})`
  - Assert: Verify written content is `"\nresult content\ntrailing"` (after marker, trimmed)

- **Test case:** "saveLatestOutput applies tail filtering"
  - Setup: Mock `getFileSystem()`, prepare outputConfig with `tail: 2`
  - Act: Call `saveLatestOutput(cwd, 'state1', 'line1\nline2\nline3\nline4', {store: true, tail: 2})`
  - Assert: Verify written content is last 2 lines only: `"line3\nline4"`

- **Test case:** "saveLatestOutput returns early if store is false"
  - Setup: Mock `getFileSystem()` (spy on calls)
  - Act: Call `saveLatestOutput(cwd, 'state1', 'content', {store: false})`
  - Assert: Verify `writeFileSync` was never called

- **Test case:** "saveLatestOutput returns early if filtered output is empty"
  - Setup: Mock `getFileSystem()` (spy on calls)
  - Act: Call `saveLatestOutput(cwd, 'state1', '   \n\n   ', {store: true})`
  - Assert: Verify `writeFileSync` was never called

- **Test case:** "saveLatestOutput overwrites existing file (not append)"
  - Setup: Mock `getFileSystem()` to simulate existing file
  - Act: Call `saveLatestOutput()` twice with different content
  - Assert: Verify `writeFileSync` (not `appendFileSync`) was used and second call overwrites

### Integration tests (`__tests__/integration/outputStore.test.ts`)

Follow the established patterns from `__tests__/integration/testUtils.ts`:

**Test case:** "Agent state with output.store creates both timestamped and latest files"
```typescript
// Sketch showing key parts
const tmp = createTmpWorkspace();
writeWorkflow(tmp, `
initial: analyze
states:
  analyze:
    type: agent
    agent: coder
    output:
      store: true
    on:
      PASSED: done
  done:
    type: engine
`);
writeAgentRegistry(tmp, { coder: { path: '.github/agents/coder.md' } });
writeScriptRegistry(tmp, {});
writeAgentFile(tmp, '.github/agents/coder.md', '---\nmodel: test\n---\n');

spawn.mockImplementation((cmd: string) => {
  if (cmd === 'copilot') return fakeChild('Analysis result\nComplete', '', 0);
  return fakeChild('', '', 0);
});

await runCommand(tmp, 'clean', {});

// Assert both files exist with same content on first run
const historyPath = path.join(tmp, '.raili', 'main', 'outputs', 'analyze.md');
const latestPath = path.join(tmp, '.raili', 'main', 'outputs', 'analyze.latest.md');
expect(fs.existsSync(historyPath)).toBe(true);
expect(fs.existsSync(latestPath)).toBe(true);
const historyContent = fs.readFileSync(historyPath, 'utf8');
const latestContent = fs.readFileSync(latestPath, 'utf8');
expect(latestContent).toContain('Analysis result\nComplete');
```

**Test case:** "Second run overwrites .latest.md but appends to timestamped file"
```typescript
// Continuation from above test
// Modify workflow context to trigger second run without reset
spawn.mockImplementation((cmd: string) => {
  if (cmd === 'copilot') return fakeChild('Updated analysis\nDone', '', 0);
  return fakeChild('', '', 0);
});

await runCommand(tmp, 'resume', {}); // Resume from last state

// Assert timestamped file has both runs separated
const historyContent2 = fs.readFileSync(historyPath, 'utf8');
expect(historyContent2).toContain('--- Run ');
expect(historyContent2).toContain('Analysis result');
expect(historyContent2).toContain('Updated analysis');

// Assert latest file contains only the new run
const latestContent2 = fs.readFileSync(latestPath, 'utf8');
expect(latestContent2).toContain('Updated analysis\nDone');
expect(latestContent2).not.toContain('Analysis result');
```

**Test case:** "Marker extraction applied identically to both files"
```typescript
// Similar setup with output config containing marker
writeWorkflow(tmp, `
...
output:
  store: true
  marker: "RESULT:"
...
`);

spawn.mockImplementation((cmd: string) => {
  if (cmd === 'copilot') return fakeChild('preamble\nRESULT:\nfiltered content\nmore', '', 0);
  return fakeChild('', '', 0);
});

await runCommand(tmp, 'clean', {});

// Assert both files contain only content after marker
const historyContent = fs.readFileSync(historyPath, 'utf8');
const latestContent = fs.readFileSync(latestPath, 'utf8');
expect(historyContent).toContain('\nfiltered content');
expect(latestContent).toContain('\nfiltered content');
expect(historyContent).not.toContain('preamble');
expect(latestContent).not.toContain('preamble');
```

## Acceptance Criteria

- [ ] `saveLatestOutput()` function exists in `src/context/outputStore.ts` with same signature and filtering logic as `saveOutput()`
- [ ] `saveLatestOutput()` writes to `<stateId>.latest.md` (without appending), overwriting previous content
- [ ] `saveOutput()` is updated to call `saveLatestOutput()` after successful append
- [ ] `storeOutput()` in `stateRunnerUtils.ts` calls both `saveOutput()` and `saveLatestOutput()`
- [ ] Both `.md` (timestamped) and `.latest.md` files receive identical filtering (marker extraction, tail)
- [ ] First run creates both files with identical content
- [ ] Second run: `.md` file has two runs with separator, `.latest.md` contains only new run
- [ ] Empty filtered output does not create either file
- [ ] All existing tests pass (no regression)
- [ ] Integration tests confirm the feature works end-to-end with agent/script/command states
