# RAI-48: Raili teach command doesn't work

**Type:** bug

## Description
The `raili teach <agentId>` CLI invocation currently fails with an "Unknown value: <agentId>" error when an agent id is passed positionally (e.g. `raili teach raili-coding`). The teach implementation (teachCommand) itself works when called programmatically — the failure is in the CLI argument parsing and help/usage exposure. Also, help/usage documentation for the teach command is missing.

## Documentation References
- documentation/usage/init.md
- documentation/usage/run.md
- documentation/usage/stats.md
- documentation (generated): src/cli/generatedDocs.ts (auto-generated from documentation/)

## Code References
- src/cli/teach.ts (teachCommand)
- src/cli.ts (main CLI flow — teach branch, parseRunArgs, prompt handling)
- src/cli/railiCommand.ts (RailiCommand — CLI command flags)
- src/cli/help.ts (formatHelp / COMMAND_HELP — missing "teach" entry)
- __tests__/integration/teach.test.ts (existing integration test for teachCommand)
- src/context/learningStore.ts (appendManualLearning used by teachCommand)

## Implementation Plan
Ordered steps with exact file locations and what to change.

1. **src/cli.ts** — Fix teach branch argument handling
   - In the branch that handles `command.teach` (around the existing `else if (command.teach)` block), make parsing tolerant of positional agentId values so `parseRunArgs()` does not throw on plain positional args.
   - Replace the current two-line parse + agentId capture with a robust flow:
     - Attempt `parseRunArgs(runArgs)` inside a try/catch. If parsing throws, ignore the parse error and continue with undefined workflowPath.
     - Derive `agentId` as the first non-flag argument: `const agentId = runArgs.find(a => !a.startsWith('-'));` (this works whether or not parseRunArgs succeeds).
   - Preserve the existing behavior that `--workflow/-w` still works when supplied.
   - Add a small comment referencing the reason (command-line-args treats bare tokens as unknown/options and can throw; teach should accept positional agentId).

2. **src/cli/help.ts** — Add usage/help text for teach
   - Add a `teach` entry to `COMMAND_HELP` describing: `Usage: raili teach <agentId> [-w <workflow>]

Open a multiline prompt, finish with /q, and append to .raili/<workflow>/learnings/<agentId>.md`.

3. **documentation/usage/teach.md** — Create a new documentation file
   - Add a short user-facing doc explaining `raili teach <agentId> [-w <workflow>]`, multiline termination `/q`, that learnings are stored at `.raili/<workflow>/learnings/<agentId>.md`, and a minimal example.
   - Note: `src/cli/generatedDocs.ts` is auto-generated. Run `npm run build:docs` as part of dev workflow to regenerate.

4. **__tests__/integration/teach_cli.test.ts** — Add an integration test exercising the CLI path
   - Create a new integration test that ensures invoking the CLI flow with a positional agentId does not throw and that teachCommand appends correctly. Use the existing `createTmpWorkspace()` + `readline` mocking pattern, and call the `main()` entrypoint in `src/cli.ts` in a way that avoids process.exit hijacking (mock `process.exit` to throw or stub it).
   - Test sketch: mock `readline.createInterface` to provide lines then `/q`; call the module's `main()` function indirectly by requiring `src/cli` and calling its exported `main()` if available, or refactor `src/cli.ts` to export a testable `main` function (see testing notes below).

5. **__tests__/unit/cli.test.ts** — Add a unit test for parsing fallback
   - Add a unit test that asserts the new tolerant logic finds `agentId` when `runArgs = ['rail-coding']` and that `parseRunArgs` errors are handled gracefully. This can import `parseRunArgs` and replicate the teach-branch logic (or import a small exported helper created to centralize the logic).

6. **Developer notes in repo** — Add a short note to the project README or docs-build workflow describing that generated help (`src/cli/generatedDocs.ts`) is produced via `npm run build:docs` so docs/ changes are picked up.

## Examples

### Example workflow YAML (no changes needed for existing teach usage)
```yaml
# workflow exists (teach requires .raili/<workflow>/ directory present)
initial: start
states:
  start:
    type: engine
```

### CLI usage (expected)
Before (current failing behavior):
$ raili teach raili-coding
Unknown value: raili-coding

After (expected):
$ raili teach raili-coding
Write a lesson to the agent 'raili-coding'. (Close with /q)
Remember to document edge cases
/q
Appended manual learning to .raili/main/learnings/raili-coding.md

### Before/After code snippet (src/cli.ts teach branch)
Before (simplified):
const parsed = parseRunArgs(runArgs);
const workflowPath = parsed.workflow ? parsed.workflow : undefined;
const agentId = runArgs[0];
await teachCommand(process.cwd(), agentId, workflowPath);

After (simplified):
let workflowPath: string | undefined;
try {
  const parsed = parseRunArgs(runArgs);
  workflowPath = parsed.workflow ? parsed.workflow : undefined;
} catch {
  workflowPath = undefined;
}
const agentId = runArgs.find((a) => !a.startsWith('-'));
await teachCommand(process.cwd(), agentId, workflowPath);

## Test Plan
Follow the repo's established testing patterns described in __tests__/integration/testUtils.ts.

### Unit tests (`__tests__/unit/`)
- **File:** `__tests__/unit/cli.test.ts`
- **Test case:** "teach branch tolerates positional agentId"
  - Setup: Provide `runArgs = ['rail-coding']`. Mock nothing else.
  - Act: Import a small exported helper (or replicate the teach-branch logic) that attempts `parseRunArgs(runArgs)` and then extracts `agentId` as `runArgs.find(a => !a.startsWith('-'))`.
  - Assert: No exception thrown; agentId === 'rail-coding'; workflowPath === undefined.

- **File:** `__tests__/unit/help.test.ts`
- **Test case:** "help includes teach usage"
  - Setup: None
  - Act: Call `formatHelp('teach')` from `src/cli/help.ts`.
  - Assert: Returned string contains `Usage: raili teach <agentId>` and mentions `/q` and `.raili/<workflow>/learnings`.

### Integration tests (`__tests__/integration/`)
- **File:** `__tests__/integration/teach_cli.test.ts`
- **Test case:** "CLI: raili teach <agentId> appends manual learning"
  - Setup:
    - Use `createTmpWorkspace()` to create tmp repo with `.raili/main/` scaffolding (write minimal workflow file).
    - Mock `readline.createInterface` (as in existing `teach.test.ts`) to emit a sample line and then `/q`.
    - Mock `process.exit` to throw a sentinel error so test can continue and inspect files (or better: import and call a testable `main()` that doesn't call process.exit; if `main` is not exported, add that small refactor in src/cli.ts: export `main` in addition to running it when `require.main === module`).
  - Act: Invoke the CLI main flow with `process.argv` set to simulate `node dist/cli.js teach agent1` or by calling exported `main()` with proper args.
  - Assert:
    - `.raili/main/learnings/agent1.md` exists
    - File contains `[manual]` and the test line

Notes on mocking and patterns:
- Use existing approaches from `__tests__/integration/teach.test.ts` for mocking `readline` (`EventEmitter`-based fake interface).
- Clean up tmp workspace with `cleanupTmpWorkspace(tmp)` in afterEach.
- For CLI invocation, either stub `process.exit` or export a testable `main()` to avoid exit; both patterns are acceptable but document the chosen approach in the implementation.

## Acceptance Criteria
- [x] Running `raili teach <agentId>` with a positional `<agentId>` no longer prints `Unknown value: <agentId>`; the prompt opens as expected.
- [x] `--workflow` / `-w` option continues to work when supplied together with `teach`.
- [x] `src/cli/help.ts` includes a `teach` entry; `raili help teach` returns teach usage.
- [x] New documentation file `documentation/usage/teach.md` exists and `npm run build:docs` includes it into `src/cli/generatedDocs.ts`.
- [x] Unit test(s) confirm parsing tolerant behavior and help formatting include teach.
- [x] Integration test verifies CLI path writes `.raili/<workflow>/learnings/<agentId>.md` with `[manual]` and the provided content.

---

Notes / Rationale
- Root cause: `parseRunArgs()` delegates to `command-line-args` which throws on unknown positional tokens; the teach command expects a positional agent id. The least disruptive fix is to make the teach branch tolerant of parse errors and extract the agentId positionally, while preserving the ability to accept `--workflow`.
- This change is small and surgical: modify only the teach branch for CLI parsing tolerance and add missing help/docs.


---

**Ticket created:** RAI-48
**Type:** bug
**Filename:** .issues/1_todo/RAI-48-bug-raili-teach-command-doesnt-work.md

