# RAI-39: Add command `raili teach` to manually add learnings

**Type:** feature

## Description
Add a new CLI command `raili teach <agentId>` that allows users to append manual learnings to an agent's learnings file. This complements automatic capture by letting users curate insights that automated extraction misses. The command should open a multiline prompt terminated by `/q` and append the entered text to `.raili/<workflow>/learnings/<agentId>.md` with an ISO timestamp and a `[manual]` source tag.

## Documentation References
- documentation/states.md
- documentation/variables.md
- documentation/usage

## Code References
- src/cli.ts (main CLI dispatch, prompt utilities)
- src/cli/RailiCommand.ts (RailiCommand class — add `teach` flag)
- src/cli/stats.ts (example CLI command pattern)
- src/context/learningStore.ts (normalizeForCompare, readLearnings, appendUniqueLearning)
- src/context/pathUtils.ts (learningsFilePath)

## Implementation Plan
Ordered, file-level steps with concrete edits. Read the files above before implementing.

1. **src/cli/RailiCommand.ts** — Add a `teach` boolean property and set it in the constructor (this.teach = this.value === 'teach').

2. **src/context/learningStore.ts** — Add a new exported function `appendManualLearning(cwd: string, agentId: string, content: string, workflowArg?: string): boolean` that:
   - Normalizes the incoming content (use existing normalizeForCompare helper) and checks against existing file to avoid exact-duplicate entries (same normalization) — mirror the dedupe logic used in appendUniqueLearning.
   - Ensures the `learnings/` directory exists.
   - Appends a block in the same format used by appendUniqueLearning but with source tag `manual` and no requirement for a `lesson:` marker. Example entry:
     - `- [2026-03-20T12:00:00Z] [manual]\n\nRemember to check edge cases in input validation.\n\n`
   - Returns true if appended, false if skipped (empty content or duplicate).

3. **src/cli/teach.ts** — Create a new module exporting `teachCommand(cwd: string, agentId: string | undefined, workflowArg?: string)` that:
   - Validates `agentId` exists (if not provided, print usage and throw an error).
   - Opens an interactive multiline prompt using `readline` similar to `collectVars` but collects all input lines until user enters `/q` on its own line.
   - Trim the final collected text; if empty, print "No content provided. Aborting." and return with non-zero exit code.
   - Call `appendManualLearning(process.cwd(), agentId, content, workflowArg)` and print a success/failure message:
     - On success: `Appended manual learning to .raili/<workflow>/learnings/<agentId>.md` (include resolved path)
     - On duplicate/no-op: `No new learning added (duplicate or empty).`

   - Keep behavior deterministic and fail-fast on missing .raili/ or invalid workflow by using existing `resolveWorkflowDir` indirectly via `learningsFilePath` — let underlying functions throw.

4. **src/cli.ts** — Wire the new command into the top-level dispatch:
   - Import the new teachCommand: `import { teachCommand } from './cli/teach';`
   - Add logic in main() alongside other branches: `} else if (command.teach) { const workflowPath = ...; const agentId = runArgs[0]; await teachCommand(process.cwd(), agentId, workflowPath); }`
   - Ensure `parseRunArgs` continues to allow `-w`/`--workflow` flag for selecting workflow.

5. **Tests — Unit:**
   - **__tests__/unit/learningStore.test.ts** — Add tests for appendManualLearning:
     - Test that empty strings return false and do not create files.
     - Test that a new manual learning gets appended with timestamp and `[manual]` tag.
     - Test deduplication: calling twice with the same content does not append the second time.
     - Use `fs` to read back the learnings file and assert structure via regex.

6. **Tests — Integration:**
   - **__tests__/integration/teach.test.ts** — Using testUtils patterns:
     - Create tmp workspace with `createTmpWorkspace()`.
     - Write a minimal workflow in `.raili/main/workflow.yaml` (content not important for `teach` but directory must exist).
     - Call `teachCommand` programmatically (imported from src/cli/teach) or simulate `node dist/cli.js teach ...` style by invoking the function directly. For interactive input simulation, use a mocked `readline` interface or spawn the function and pipe input; simpler: in the integration test, call `teachCommand(tmpDir, 'agent1')` but mock `readline.createInterface` to return a fake interface that emits lines then closes. Jest patterns in repo usually mock `child_process`; mocking `readline` is acceptable.
     - Assert that `.raili/main/learnings/agent1.md` exists and contains ` [manual] ` and the provided text.
     - Clean up tmp workspace.

7. **Documentation:**
   - Add a short usage note to `documentation/usage` (or `documentation/usage.md`) explaining `raili teach <agentId>` and `-w` flag. (If docs generation requires build, keep text small.)

8. **Optional:** Consider exporting `appendManualLearning` in any central context exports if other modules should reuse it.

## Examples

### CLI usage

```
$ raili teach analyzer -w main
Write a lesson to the agent 'analyzer'. (Close with /q)
> Remember to check edge cases in input validation.
> /q
Appended manual learning to .raili/main/learnings/analyzer.md
```

### Resulting learnings file (.raili/main/learnings/analyzer.md)

- [2026-03-20T12:00:00Z] [manual]

Remember to check edge cases in input validation.

### Before / After (calling appendManualLearning)

Before: (file absent or empty)

After file contains one block starting with `- [<ISO timestamp>] [manual]` followed by the body text and a blank line.

## Test Plan

### Unit tests (`__tests__/unit/learningStore.test.ts`)
- Test case: "appendManualLearning appends non-empty manual learning"
  - Setup: create a temp folder (use `fs.mkdtempSync`) and ensure `.raili/main/learnings` exists.
  - Act: call `appendManualLearning(tmp, 'agent1', 'This is a manual lesson.', 'main')`.
  - Assert: file exists and matches regex `/^- \[\d{4}-\d{2}-\d{2}T.*Z\] \[manual\]\n\nThis is a manual lesson\./m` and function returned true.

- Test case: "appendManualLearning ignores empty input"
  - Act: call with `''` or whitespace only.
  - Assert: returns false and no file created.

- Test case: "appendManualLearning deduplicates exact content"
  - Act: call twice with same content.
  - Assert: second call returns false and file contains only one appended block.

### Integration tests (`__tests__/integration/teach.test.ts`)
Follow patterns from `__tests__/integration/testUtils.ts`:

- Test case: "raili teach writes manual learning to workflow learnings file"
  - Setup:
    - const tmp = createTmpWorkspace();
    - writeNamedWorkflow(tmp, 'main', `initial: start\nstates: {}`) // or writeWorkflow
  - Mock interactive input:
    - jest.spyOn(readline, 'createInterface').mockImplementation once to return an object with question()/on()/close() that yields lines: 'Remember...', '/q'. Or programmatically call teachCommand with a custom input stream.
  - Act: await teachCommand(tmp, 'agent1', 'main')
  - Assert: fs.existsSync(path.join(tmp, '.raili', 'main', 'learnings', 'agent1.md')) === true
    - Content contains `[manual]` and the lesson text.

- Use `cleanupTmpWorkspace(tmp)` after test.

Mocking notes: prefer mocking `readline.createInterface` to a controllable fake to avoid real stdin interaction. See existing tests for mocking patterns (child_process is mocked there). Use `afterEach(() => jest.restoreAllMocks())` to reset mocks.

## Acceptance Criteria
- [ ] `raili teach <agentId> [-w <workflow>]` command is discoverable in CLI (`raili --help` shows `teach`) or `railCommand` recognizes `teach` and running it executes the new flow.
- [ ] Interactive multiline prompt appears with the exact prompt: "Write a lesson to the agent '<agentId>'. (Close with /q)" and user can type multiple lines until `/q`.
- [ ] The entered text is appended to `.raili/<workflow>/learnings/<agentId>.md` as a block prefixed with an ISO timestamp and `[manual]` tag as shown in examples.
- [ ] Duplicate entries (text matching existing entry after whitespace normalization) are not appended.
- [ ] Unit tests cover appendManualLearning (empty input, append, duplicate), and an integration test verifies the full CLI flow using testUtils patterns.

---

Slug: add-command-raili-teach

Created file: .issues/1_todo/RAI-39-feature-add-command-raili-teach.md

Filename: RAI-39-feature-add-command-raili-teach.md

Complete
