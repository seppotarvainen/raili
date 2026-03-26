# RAI-47: Fix lesson store format

**Type:** bug

## Description
Every lesson stored in the learnings files should be written as a single physical line; internal newlines must be escaped as the two-character sequence "\\n". Currently lessons are stored as multi-line blocks which leads to parsing bugs (a trailing '-' getting glued to the previous lesson) and brittle whitespace handling. Also, remove the uniqueness check so lessons are always appended (no dedup logic).

## Documentation References
- docs/workflow-yaml.md [File removed as redundant (26.3.2026)]
- documentation/ (no dedicated learning doc found)

## Code References
- src/context/learningStore.ts (extractLessons, stripTimestampsFromLearnings, readLearningsForPrompt, appendUniqueLearning, appendManualLearning)
- src/runner/AgentStateRunner.ts (uses appendUniqueLearning, readLearningsForPrompt)
- __tests__/integration/testUtils.ts (test helpers referenced in Test Plan)

## Implementation Plan
Ordered steps (apply in order):

1. **src/context/learningStore.ts** — Update storage format and parsing logic
   - Modify `extractLessons(content: string): string[]` to return lessons where internal newlines are replaced with the two-character sequence `\\n`. Example: `"line1\nline2" -> "line1\\nline2"`.
   - Replace block-oriented parsing in `stripTimestampsFromLearnings(content: string): string[]` with a line-oriented parser. New parser should match single-line entries of the form:
     `- [<ISO_TIMESTAMP>] [<sourceTag>] <lesson-with-\\n-escapes>`
     For each entry, decode `\\n` to actual newlines when producing strings returned by this function (so prompts get readable multi-line text).
   - Change `appendUniqueLearning(...)` to stop checking for uniqueness. Always append each extracted lesson. Store entries as single-line records (one lesson per physical line) using the format:
     `- [<ISO_TIMESTAMP>] [<sourceTag>] <lesson-with-\\n-escapes>\n`
     (i.e., exactly one trailing newline, no blank line separators).
   - Change `appendManualLearning(...)` similarly: remove normalization/contains checks and append a single-line entry with `\\n` escapes.
   - Remove or stop using `normalizeForCompare` for deduping; it may be left if used elsewhere, but do not use it here.

2. **src/runner/AgentStateRunner.ts** — No API change needed, but ensure callers still pass content unchanged (this file already calls `appendUniqueLearning(...)` and `readLearningsForPrompt(...)`). Update comments if desired.

3. **Add unit tests** (see Test Plan) in `__tests__/unit/learningStore.test.ts` covering both storage and parsing changes.

4. **Add integration test** sketch in `__tests__/integration/learning-lessons.test.ts` to validate that a multi-line lesson appended via agent output or manual call is stored as a single line containing `\\n` and that `readLearningsForPrompt` reconstructs newlines for prompt injection.

5. Run existing test suite (`npm test`) and iterate on failures.

## Examples

### Before (problematic file content)
```
- [2026-03-20T11:09:47.394Z] [var:ACT_MULTILINE_FAILED] /1
- [2026-03-21T17:02:04.050Z] [var:ACT_MULTILINE_FAILED] You should always remember to trust yourself.- [2026-03-25T11:02:14.488Z] [var:ACT_MULTILINE_FAILED]

This is a test lesson.
```
(The second `- [` stuck to the previous lesson body.)

### After (desired file content)
```
- [2026-03-20T11:09:47.394Z] [var:ACT_MULTILINE_FAILED] /1
- [2026-03-21T17:02:04.050Z] [var:ACT_MULTILINE_FAILED] You should always remember to trust yourself.\n\nThis is a test lesson.
- [2026-03-25T11:02:14.488Z] [var:ACT_MULTILINE_FAILED] (another lesson)\n
```
(Each lesson is exactly one physical line. Internal blank lines represented as `\\n\\n`.)

### Example behaviour when injected into prompt
- Stored line: `- [2026-03-21T17:02:04.050Z] [var:ACT_MULTILINE_FAILED] You should always remember to trust yourself.\\n\\nThis is a test lesson.`
- After `readLearningsForPrompt` this becomes human-readable:

```
[ var:ACT_MULTILINE_FAILED ]
You should always remember to trust yourself.

This is a test lesson.
```

## Test Plan

### Unit tests (`__tests__/unit/learningStore.test.ts`)
- **Test case:** `extractLessons replaces internal newlines with \\\\n`
  - Setup: Provide multi-line input containing `lesson:` marker and internal blank lines.
  - Act: Call `extractLessons(input)`.
  - Assert: Returned array contains a single string where newlines inside lesson are replaced by the literal `\\n` sequence, and leading/trailing whitespace removed.

- **Test case:** `appendUniqueLearning writes single-line entries`
  - Setup: Create a temp workspace (use Node tmpdir) with `.raili/<workflow>/learnings` directory. Provide content with `lesson:` marker and multiple lines.
  - Act: Call `appendUniqueLearning(tmpCwd, 'agentX', 'output:state', content)`.
  - Assert: The file exists and the appended entry is a single physical line starting with `- [<ISO>] [output:state] `, and the lesson body contains `\\n` sequences where original had newlines.

- **Test case:** `stripTimestampsFromLearnings decodes \\\\n to actual newlines`
  - Setup: Create a file content with several single-line entries using `\\n` escapes.
  - Act: Call `stripTimestampsFromLearnings(content)`.
  - Assert: Returned array elements contain actual newline characters (`\n`) corresponding to the escaped sequences.

### Integration test (`__tests__/integration/learning-lessons.test.ts`)
Follow established integration test patterns from `__tests__/integration/testUtils.ts`:

- Use `createTmpWorkspace()` to make a sandbox.
- Write a minimal workflow and agent registry.
- Mock `child_process` spawn: return a `fakeChild` whose stdout contains a multi-line lesson with `LESSON:` marker.
- Run the engine (use existing runCommand helper in repo) to trigger `appendUniqueLearning` via `AgentStateRunner`.
- Assert on `.raili/main/learnings/<agentId>.md` that:
  - Each appended lesson is on a single line.
  - The line contains `\\n` sequences representing internal newlines.
- Also call `readLearningsForPrompt` and assert it returns a string where `\\n` are converted into actual newlines suitable for prompt injection.

Sketch test snippet (integration):
```typescript
// inside test
const tmp = createTmpWorkspace();
writeAgentRegistry(tmp, { analyzer: { path: '.github/agents/analyzer.md' } });
writeAgentFile(tmp, '.github/agents/analyzer.md', '---\n');
// write workflow that runs the agent and uses learn_from: output:prev
spawn.mockImplementation((cmd: string) => {
  if (cmd === 'copilot') return fakeChild('lesson:\nLine1\nLine2', '', 0);
  return fakeChild('', '', 0);
});
await runCommand(tmp, 'clean', {});
const learnFile = path.join(tmp, '.raili', 'main', 'learnings', 'analyzer.md');
const contents = fs.readFileSync(learnFile, 'utf8');
expect(contents.split('\n').filter(Boolean).length).toBeGreaterThan(0);
expect(contents.includes('\\n')).toBe(true); // stored escapes
const prompt = readLearningsForPrompt(tmp, 'analyzer');
expect(prompt.includes('\n')).toBe(true); // decoded for prompt
```

## Acceptance Criteria
- [x] All lessons are written as single-line entries in the learnings file (one lesson per physical line).
- [x] Internal newlines inside lessons are escaped as `\\n` when stored.
- [x] `stripTimestampsFromLearnings` decodes `\\n` into actual newlines when preparing prompt text.
- [x] The uniqueness/deduplication check in `appendUniqueLearning` and `appendManualLearning` is removed; lessons are always appended.
- [x] Unit tests cover extract/append/parse behaviors and pass.
- [ ] Integration test verifies the stored format and prompt decoding and passes.

---

**Ticket ID:** RAI-47
**Type:** bug
**Filename:** RAI-47-bug-fix-lesson-store-format.md
