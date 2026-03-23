# RAI-37: Update output store to behave like learnings store

**Type:** improvement

## Description
Change output storage behavior so it extracts everything after a single marker (default "OUTPUT:") — mirroring the learnings store behavior which uses a "LESSON:" marker. The output store will accept an optional `marker` field; when present the first occurrence (case-insensitive) of that marker in the state output will be used and everything after it will be persisted. The existing line-matching fields (`include_search_pattern`, `include_after`) will no longer be used.

## Documentation References
- docs/output.md
- docs/workflow-yaml.md

## Code References
- src/context/outputStore.ts (filterOutput, saveOutput, readLatestRun)
- src/context/learningStore.ts (extractLessons, appendUniqueLearning) — behavior reference
- src/types.ts (OutputConfig interface)
- src/workflow/schemas.ts (OutputConfigSchema)
- src/workflow/schemaValidator.ts (validateStateConfig) — may need schema awareness
- src/context/pathUtils.ts (resolveWorkflowDir) — used by outputStore
- __tests__/integration/testUtils.ts (fakeChild, createTmpWorkspace, writeWorkflow helpers) — test patterns

## Implementation Plan
Ordered steps to implement the change. Each step names the file and the exact change.

1. **src/types.ts** — Modify OutputConfig interface:
   - Remove `include_search_pattern?: string` and `include_after?: number` fields.
   - Add `marker?: string` (optional). Document default in comment: default is `"OUTPUT:"`.

2. **src/workflow/schemas.ts** — Update OutputConfigSchema:
   - Remove `include_search_pattern` and `include_after` entries.
   - Add `marker` entry (type: string, required: false, description: "Marker string to locate the start of the stored output; first occurrence is used; default: 'OUTPUT:'").

3. **src/context/outputStore.ts** — Replace filterOutput implementation:
   - Remove the current regex-based include_search_pattern/include_after logic.
   - Implement new marker-based extraction logic:
     - Determine marker = config.marker ?? 'OUTPUT:'
     - Perform a case-insensitive search for the first occurrence of the marker in `output`. If not found, treat the entire output as candidate (or decide: existing behavior ignored — see Acceptance Criteria). Per spec, only store content after marker; if marker not found store nothing? The user usage implies marker is optional and defaults to OUTPUT:; to preserve useful output when marker absent, behavior should fall back to storing whole output. Implement: if marker found, take everything after first marker; else use full output.
     - Trim leading/trailing blank lines but preserve internal newlines.
     - After extraction, apply `tail` if present (same as current behavior).
   - Update JSDoc and comments accordingly.

4. **src/context/outputStore.ts** — Update saveOutput JSDoc and behavior to rely on new filterOutput. Ensure early return semantics: if filteredOutput is empty string after extraction, do not write file (keep current guard behavior).

5. **src/workflow/schemaValidator.ts** — No code-level changes required for behavior, but confirm that schema validation still accepts `marker` and rejects unknown `include_search_pattern`/`include_after`. If schemaValidator enforces only fields present in StateConfigSchema (it relies on schemas.ts), the change in schemas.ts is sufficient. Update any custom validation messages if they referenced the old fields.

6. **Tests — Unit**
   - Add `__tests__/unit/outputStore.test.ts`:
     - Test marker extraction when marker present (case variations) and ensure result equals substring after first marker (preserve newlines, trim edges).
     - Test fallback when marker not present: full output is returned and tail applied.
     - Test tail trimming after extraction.

7. **Tests — Integration**
   - Add `__tests__/integration/outputStore.test.ts`:
     - Use `createTmpWorkspace()` and `writeWorkflow()` to create a workflow with an agent state that has `output: { store: true, marker: 'SUMMARY:' }`.
     - Mock `child_process.spawn` to return a stdout containing text and the marker; verify .raili/main/outputs/<stateId>.md contains the content after the marker.
     - Verify `readLatestRun()` returns the expected content.

8. **Documentation**
   - Update `docs/output.md` to document the `marker` field and show example YAML usage and the default marker value. Include migration note: old fields removed.

9. **Optional cleanup**
   - Search repository for `include_search_pattern` and `include_after` usages. Remove or adjust usages if found (likely only in schemas and types). Update any comments referencing the old behavior.

10. Run test suite: `npm test` and fix any failing tests caused by schema/type changes.

## Examples

### Example workflow YAML
```yaml
code:
  type: agent
  agent: raili-coding
  prompt: "work according to your rules."
  output:
    store: true
    marker: 'SUMMARY:' # optional, defaults to "OUTPUT:"
    # tail (if present) is applied after extraction
  on:
    PASSED: format
```

### Before / After extraction (stdout)

Before (raw agent stdout):
```
Some analysis text
SUMMARY:
- Key point A
- Key point B
More commentary
```

After (stored to .raili/main/outputs/code.md):
```
- Key point A
- Key point B
More commentary
```

If marker not present, entire output is considered and then tail applied (so short outputs still stored).

## Test Plan

### Unit tests (`__tests__/unit/outputStore.test.ts`)
- **Test:** "extracts after first marker (case-insensitive)"
  - Setup: Provide a multiline string with several occurrences of 'SUMMARY:' (different cases) and a config.marker = 'SUMMARY:'
  - Act: Call filterOutput(output, config) (exported via re-export or by importing module internals)
  - Assert: Returned string equals substring starting after the first occurrence; preserves newlines; leading/trailing whitespace trimmed.

- **Test:** "falls back to full output when marker not present"
  - Setup: output without marker, config.marker = 'SUMMARY:'
  - Act: filterOutput
  - Assert: Returned string equals the full trimmed output (and tail applied if present)

- **Test:** "applies tail after extraction"
  - Setup: output with marker followed by many lines, config.tail = 2
  - Act: filterOutput
  - Assert: Only last 2 lines of the extracted content are returned.

### Integration test (`__tests__/integration/outputStore.test.ts`)
Follow established patterns in `__tests__/integration/testUtils.ts`:

- **Test case:** "agent state stores content after marker to outputs file"
  - Setup:
    - const tmp = createTmpWorkspace();
    - writeAgentRegistry(tmp, { 'raili-coding': { path: '.github/agents/raili-coding.md' } });
    - writeAgentFile(tmp, '.github/agents/raili-coding.md', '---\nmodel: test\n---\n');
    - writeWorkflow(tmp, `initial: code\nstates:\n  code:\n    type: agent\n    agent: raili-coding\n    output:\n      store: true\n      marker: 'SUMMARY:'\n    on:\n      PASSED: done\n  done:\n    type: engine`);
    - jest.mock('child_process', () => ({ spawn: jest.fn() }));
    - spawn.mockImplementation((cmd) => {
        if (cmd === 'copilot') return fakeChild('intro\nSUMMARY:\nline1\nline2\n', '', 0);
        return fakeChild('', '', 0);
      });
  - Act: await runCommand(tmp, 'clean', {});
  - Assert:
    - const p = path.join(tmp, '.raili', 'main', 'outputs', 'code.md');
    - expect(fs.existsSync(p)).toBe(true);
    - const content = fs.readFileSync(p, 'utf8');
    - expect(content).toContain('line1\nline2');
    - const latest = readLatestRun(tmp, 'code');
    - expect(latest).toContain('line1\nline2');

Notes on mocking: Reuse `fakeChild`, `createTmpWorkspace`, `writeWorkflow`, `writeAgentRegistry` helpers from `testUtils.ts`. Clean up env vars using `cleanupRailiEnvVars()` in afterEach.

## Acceptance Criteria
- [x] OutputConfig type includes `marker?: string` and no longer exposes `include_search_pattern` / `include_after`.
- [x] Schema (`src/workflow/schemas.ts`) accepts `marker` and no longer documents `include_search_pattern` / `include_after`.
- [x] Output extraction behavior: when marker is present, everything after the first case-insensitive occurrence of the marker is persisted; when no marker found, full output is persisted.
- [x] `tail` is applied after extraction, preserving current semantics.
- [x] Unit tests cover extraction, fallback, and tail behavior.
- [x] Integration test verifies an agent run writes the expected text to `.raili/main/outputs/<stateId>.md` and `readLatestRun()` returns it.
- [x] Documentation `documentation/output.md` is updated with examples and default marker value.


---

Ticket created: ID=RAI-37, Type=improvement
Filename: .issues/1_todo/RAI-37-improvement-output-store-like-learnings.md

Completed creation of the issue file.

complete