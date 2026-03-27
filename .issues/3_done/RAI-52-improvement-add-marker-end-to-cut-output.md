# RAI-52: Add marker_end to cut output

**Type:** improvement

## Description
Add support for an optional `marker_end` field on state `output` configuration to allow capturing a bounded slice of stdout/stderr between a start marker and an end marker. This controls the size and coherence of persisted outputs and agent memory. Also remove the implicit default marker `OUTPUT:` so that marker-based extraction only runs when explicitly configured.

## Documentation References
- documentation/output.md

## Code References
- src/context/outputStore.ts (filterOutput, saveOutput)
- src/types.ts (OutputConfig)
- src/workflow/schemas.ts (OutputConfigSchema)
- src/runner/agentStateRunner.ts (calls saveOutput)
- src/runner/stateRunnerUtils.ts (processStateResult -> saveOutput)
- __tests__/unit/context/outputStore.test.ts (filterOutput unit tests)

## Implementation Plan
Ordered steps for a coding agent to follow. Each step names the file and exact function/type to change.

1. **src/types.ts** — Update `OutputConfig` interface:
   - Add optional field `marker_end?: string`.
   - Update the `marker` comment to remove the "default: OUTPUT:" text.

2. **src/workflow/schemas.ts** — Update `OutputConfigSchema`:
   - Add `marker_end` field schema: required: false, type: 'string', description: 'Optional marker string to locate the end of the stored output (first occurrence, case-insensitive)'.
   - Update `marker` description to remove the default mention.

3. **src/context/outputStore.ts** — Update `filterOutput(output: string, config: OutputConfig)` implementation:
   - Remove the hardcoded default marker 'OUTPUT:'. Treat `config.marker` and `config.marker_end` as optional.
   - Implement these extraction rules (case-insensitive searches):
     - If neither `marker` nor `marker_end` are provided => keep the full `output` (current fallback behavior when marker not present).
     - If only `marker` is provided => find first occurrence of `marker` (case-insensitive) and return everything after it (current behavior except for the removed default).
     - If only `marker_end` is provided => find first occurrence of `marker_end` (case-insensitive) and return everything before it.
     - If both `marker` and `marker_end` are provided => find first occurrence of `marker` and the first occurrence of `marker_end` that occurs after the found start; extract the substring between them. If `marker_end` is found before `marker`, treat as marker_end not found (i.e., behave as if only `marker` present, returning everything after `marker`).
   - Keep existing trimming of leading/trailing blank lines and the `tail` behavior.
   - Ensure the searches are done case-insensitively but slicing preserves original case/spacing.

4. **src/context/outputStore.ts** — Add unit-safety guards:
   - If the extracted substring is empty after trimming, return empty so saveOutput will skip storing.

5. **src/workflow/schemas.ts** (docs) — Ensure schema description of `marker` and `marker_end` are clear and explicit that both are optional and case-insensitive.

6. **documentation/output.md** — Update the docs to describe `marker_end` and remove the note that `marker` defaults to `OUTPUT:`. Add examples showing use-cases: marker only, marker_end only, and both.

7. **__tests__/unit/context/outputStore.test.ts** — Extend unit tests for `filterOutput`:
   - Add test: extracts between marker and marker_end (case-insensitive) when both present.
   - Add test: extracts before marker_end when only marker_end provided.
   - Modify the existing test that relied on default `OUTPUT:` to pass an explicit marker (do not rely on default).
   - Keep tests for tail behavior and trimming.

8. **__tests__/integration/** (suggested) — Add an integration test sketch (optional but recommended):
   - New test `__tests__/integration/output_marker.test.ts` that creates a tmp workspace, writes an agent file that emits content with `//SUMMARY//` and `//SUMMARY_END//`, sets up agent registry and workflow with `output.marker` and `output.marker_end`, mocks `child_process.spawn` to return fakeChild(stdoutWithMarkers, '', 0), runs the engine, and asserts that `.raili/main/outputs/<state>.md` exists and contains only the sliced content.

9. Run unit tests (`npm test`) and ensure all tests pass. Fix any linting/type errors introduced by the new field.

## Examples

### Example workflow YAML (from request)
```yaml
state:
  type: agent
  agent: coding
  output:
    store: true
    marker: '//SUMMARY//'
    marker_end: '//SUMMARY_END//'
  transitions:
    default: check_done
```

### Expected behavior / output
Given agent stdout (exact content):

Intro text
//SUMMARY//
- Point A
- Point B
//SUMMARY_END//
Footer notes

- With both markers configured: persisted content must be:
```
- Point A
- Point B
```
- With only `marker` configured (marker='//SUMMARY//'): persisted content must be everything after the marker through the end:
```
- Point A
- Point B
//SUMMARY_END//
Footer notes
```
- With only `marker_end` configured (marker_end='//SUMMARY_END//'): persisted content must be everything before the marker (from the start):
```
Intro text
//SUMMARY//
- Point A
- Point B
```
- If neither marker is configured: persisted content is the full stdout (current behavior when marker omitted).

Edge behaviors:
- Searches are case-insensitive: 'Summary:' matches 'SUMMARY:'.
- If `marker` is present but `marker_end` not found after it, behave like marker-only (everything after `marker`).
- If `marker_end` appears before `marker`, treat `marker_end` as not found and behave like marker-only (everything after `marker`).

## Test Plan

### Unit tests (`__tests__/unit/`)
- **File:** `__tests__/unit/context/outputStore.test.ts` (modify existing)

Test case: "extracts between marker and marker_end (case-insensitive)"
- Setup: stdout string with a start marker (e.g. `Summary:`) and end marker `END:` later in text.
- Act: call `filterOutput(out, { store: true, marker: 'SUMMARY:', marker_end: 'END:' })`.
- Assert: returned string equals the substring between the markers, trimmed of leading/trailing blank lines.

Test case: "extracts before marker_end when only marker_end provided"
- Setup: stdout with some header and a marker_end string.
- Act: `filterOutput(out, { store: true, marker_end: 'END:' })`.
- Assert: returned string equals everything before the first occurrence of marker_end (trimmed).

Test case: "falls back to full output when neither marker present"
- Setup: stdout without markers.
- Act: `filterOutput(out, { store: true })`.
- Assert: returns full output trimmed (existing behavior).

Test case: "marker present but marker_end before marker -> behave like marker-only"
- Setup: out where marker_end occurs before marker.
- Act: `filterOutput(out, { store: true, marker: 'START', marker_end: 'END' })`.
- Assert: returns everything after `START` (marker-only behavior). This documents the chosen disambiguation.

Test case: "tail applied after extraction"
- Existing test retained and updated to use explicit marker values.

Mocking: none (pure function). Use imports from `src/context/outputStore`.

### Integration tests (`__tests__/integration/`) (recommended)
Follow patterns in `__tests__/integration/testUtils.ts`.

Test case: "agent output is sliced by marker and marker_end and saved"
- Setup:
  - createTmpWorkspace()
  - writeAgentRegistry(tmp, { coding: { path: '.github/agents/coding.md' } })
  - writeAgentFile(tmp, '.github/agents/coding.md', '---\nmodel: gpt-test\n---\n# agent')
  - writeWorkflow(tmp, `initial: s1\nstates:\n  s1:\n    type: agent\n    agent: coding\n    output:\n      store: true\n      marker: '//SUMMARY//'\n      marker_end: '//SUMMARY_END//'`)
- Mock: `jest.mock('child_process', () => ({ spawn: jest.fn() }))` and implement `spawn.mockImplementation(() => fakeChild(agentStdoutWithMarkers, '', 0))`.
- Act: await runCommand(tmp, 'clean', {});
- Assert: read `.raili/main/outputs/s1.md` and expect it contains only the sliced content shown in Examples.
- Cleanup: cleanupRailiEnvVars(); cleanupTmpWorkspace(tmp)

## Acceptance Criteria
- [ ] `src/types.ts` exports `OutputConfig` with `marker_end?: string` and `marker` no longer implies a default value.
- [ ] `src/context/outputStore.ts` `filterOutput` implements extraction for `marker`, `marker_end`, both, and neither, following the rules above and preserving case-insensitive search.
- [ ] `src/workflow/schemas.ts` includes `marker_end` schema and updated `marker` description.
- [ ] `documentation/output.md` updated to describe `marker_end` and removal of the `OUTPUT:` default.
- [ ] Unit tests under `__tests__/unit/context/outputStore.test.ts` updated/added to cover marker_end scenarios and existing tail/trimming logic.
- [ ] Integration test (recommended) that verifies end-to-end saving of sliced output exists or is added to `__tests__/integration/`.
- [ ] All tests pass locally (`npm test`).

---

Ticket ID: RAI-52
Type: improvement

Filename: .issues/1_todo/RAI-52-improvement-add-marker-end-to-cut-output.md

Complete
