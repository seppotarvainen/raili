# RAI-51: Remove 'learn_from' and replace it with 'teach'

**Type:** improvement

## Description
Change agent learning from a pull-based `learn_from` feature to a push-based `teach` phase. `learn_from` is removed (no backwards compatibility). Lessons are now delivered by any state that declares a `teach:` block mapping agent IDs to lesson sources; teach happens last (after feedback) so lessons are always pushed immediately when produced.

Rationale: current `learn_from` only taught agents when the agent state was entered. If lessons were produced but the agent state wasn't re-entered, the agent never received them. A push-based `teach` ensures lessons propagate immediately and deterministically.

## Documentation References
- documentation/states.md
- documentation/output.md

## Code References
- src/types.ts (StateConfig) — remove learn_from, add teach?: Record<string, LearnSource[]>
- src/workflow/schemas.ts (StateConfigSchema) — remove learn_from schema, add teach schema
- src/workflow/stateValidator.ts (validateStateConfig, collectFailFastVarRefs) — update validations
- src/workflow/workflowLoader.ts (buildStateMachine, validateStateMachine) — remove learn_from cross-state validation and add teach validation where appropriate
- src/runner/agentStateRunner.ts (AgentStateRunner.run, runAgentState) — remove in-run processing of learn_from and prompt injection remains (readLearningsForPrompt still used)
- src/runner/runner.ts (or equivalent run loop) — add teach phase after feedback handling to process state.config.teach entries (call appendUniqueLearning)
- src/context/learningStore.ts (appendUniqueLearning, readLearningsForPrompt) — no API change expected but review for compatibility
- src/cli/generatedDocs.ts — remove references to learn_from and add teach docs
- documentation/states.md, documentation/output.md — update examples & narrative
- __tests__/unit/runner/agentStateRunner.test.ts — remove learn_from unit tests; update to reflect teach removal
- __tests__/unit/workflow/workflowLoader.test.ts — replace learn_from validation tests with teach tests
- __tests__/integration/learning.integration.test.ts — update integration test to assert teach behavior (producer state uses teach -> agent receives learning)

## Implementation Plan
Ordered steps with file-level edits. Read each file before editing and run tests after changes.

1. **src/types.ts** — Replace `learn_from?: LearnSource[]` with:
   - `teach?: Record<string, LearnSource[]>;`
   - Update comments on LearnSource if needed. Keep LearnSource type unchanged.

2. **src/workflow/schemas.ts** — Remove `learn_from` schema (lines ~174-180). Add `teach` field:
   - `teach: { required: false, type: 'record', description: 'Map of <agentId> -> list of sources to teach (objects {output: stateId} or {var: "${VAR}"})', validForTypes: ['agent','script','command','engine','group'] }`
   - (Use record type and do not restrict keys — agent IDs validated at runtime when used.)

3. **src/workflow/stateValidator.ts** —
   - Remove logic that excludes `learn_from` from fail-fast var refs (line where collectFailFastVarRefs destructures learn_from). Ensure `teach` is not excluded from var ref collection (teach is allowed to contain var refs but we should validate them separately).
   - Add a new validator to check `teach` shape is an object mapping agentId -> array; ensure each entry is an array, each item is object with single key `output` or `var`; reuse the previous learn_from per-entry validation logic.

4. **src/workflow/workflowLoader.ts** —
   - In validateStateMachine (cross-state validation), remove the `learn_from` cross-state checks (lines ~363-392).
   - Add cross-state validation for `teach`: for each state that has `teach`, for each agentId -> source entry:
     - If source has `output`, ensure referenced state exists in machine.states and that the referenced state's config.output?.store === true (same rule as previous).
     - If source has `var`, ensure it matches pattern /^\$\{[A-Za-z_][A-Za-z0-9_]*\}$/.

5. **src/runner/agentStateRunner.ts** —
   - Remove the entire block that processed `state.config.learn_from` at the start of run (lines ~38-68 in current file). The agent runner should no longer append learnings from other states when the agent state is entered.
   - Keep the readLearningsForPrompt injection logic (lines ~70-85) so persisted learnings (from previous teach phases) are still injected into prompts.

6. **src/runner/runner.ts** (or the file that orchestrates per-state phases — search for run loop) —
   - Add a new phase executed after the feedback/approval phases and after storing outputs: "Teach phase".
   - Implementation: if `state.config.teach` exists, iterate Object.entries(state.config.teach) as [agentId, sources[]]. For each source:
     - If source.output: readLatestRun(cwd, source.output, workflowArg) and if non-empty appendUniqueLearning(cwd, agentId, `output:${source.output}`, contentOneLineOrParagraph, workflowArg).
     - If source.var: resolve the ${VAR} using the current vars/context (fail-fast on missing var if it's used in a non-prompt context). When present and non-empty call appendUniqueLearning(cwd, agentId, `var:${VAR}`, value).
   - Ensure teach runs last (after feedback) and errors are handled per fail-fast policy: validation has already checked references; runtime missing var should cause an error (consistent with variable interpolation rules) or skip? Decide: follow existing approach for learn_from cross-state validation — missing var at runtime should throw (fail-fast). The ticket mandates deterministic behavior; prefer throwing on missing variable to surface config/user error.

7. **src/cli/generatedDocs.ts**, **documentation/states.md**, **documentation/output.md** — update textual and examples: remove `learn_from` references and replace with `teach` examples (include the YAML example from the ticket). Update the 'Agent Memory Strategy' and 'Learnings (opt-in)' sections to describe push-based teach and the new file locations/semantics.

8. **Tests** — Update and add tests (see Test Plan). Specifically:
   - **__tests__/unit/runner/agentStateRunner.test.ts** — remove tests that assert learn_from behavior (appending learnings during agent entry). Keep tests that assert prompt injection from persisted learnings via readLearningsForPrompt.
   - **__tests__/unit/workflow/workflowLoader.test.ts** — replace learn_from validation unit tests with teach validation tests (shape, unknown state ref, output.store requirement, var pattern).
   - **__tests__/integration/learning.integration.test.ts** — change workflow in the integration test so the producing state declares `teach: { test_agent: [{ output: produce }] }` (or uses var) and assert that after the producer runs the agent's learnings file contains the expected lesson and that the agent run reads the lesson (if an agent is executed later in the same run it should see the lesson via readLearningsForPrompt). Use existing testUtils fakeChild patterns.

9. Run the test suite and iterate until passing: `npm test --silent`.

10. Update changelog / docs entry (if present) to note removal of learn_from and new teach semantics.

## Examples

### Example workflow YAML (from ticket)
```yaml
code:
  type: agent
  agent: raili-coding
  transitions:
    default: check_done

check_done:
  type: engine
  approval:
    question: 'Does everything look good now. Give agent a lesson if not?'
    PASSED: are_there_lessons
    FAILED: code
  teach:
    raili-coding:
      - var: ${CHECK_DONE_FAILED}

are_there_lessons:
  type: engine
  feedback:
    question: 'Do you have any lessons to teach the agent? If so, please provide them now.'
    expose_var: 
      - TEACH_AGENT
  teach:
    raili-coding:
      - var: ${TEACH_AGENT}
  on:
    PASSED: done

done:
  type: engine
  success: true
```

### Before / After behavior
- Before: lessons were declared on agent states via `learn_from` and were only consumed when that agent state ran again.
- After: lessons are declared on producer states via `teach` and are immediately appended to the agent's persistent learnings file. Agents continue to receive persisted learnings when they run (no change to injection mechanism).

## Test Plan

### Unit tests (`__tests__/unit/`)

- File: `__tests__/unit/workflow/workflowLoader.test.ts` — "validates teach entries and references"
  - Setup: build a minimal machine object using buildStateMachine or loadWorkflowConfig with a workflow that includes a `teach:` block referencing an existing state with `output.store: true` and a var entry.
  - Act: call validateStateMachine(machine) (or loadWorkflowConfig then buildStateMachine then validateStateMachine).
  - Assert: no throw for valid configuration; throws with appropriate message for:
    - teach referencing unknown state
    - teach referencing state without output.store: true
    - teach var entry not in ${VAR_NAME} form

- File: `__tests__/unit/runner/agentStateRunner.test.ts` — "agent prompt still injects persisted learnings"
  - Setup: mock `reading` from learningStore.readLearningsForPrompt to return a non-empty string
  - Act: run runAgentState with a prompt defined
  - Assert: executeAgent called with assembled prompt containing the learnings header and body

### Integration tests (`__tests__/integration/`)
Follow established patterns from `__tests__/integration/testUtils.ts`.

- File: `__tests__/integration/learning.integration.test.ts` — "teach appends lesson and agent sees it"
  - Setup:
    - createTmpWorkspace(), writeWorkflow(tmp, ... ) where workflow contains:
      - `produce` state (command) that echoes a LESSON: block and has `output.store: true` and `on: PASSED -> analyze`
      - `produce` state also declares `teach:` mapping to `test_agent` referencing `output: produce` (note: teach may be on same state that produced the output)
      - `analyze` state of type agent that uses agent `test_agent` with prompt and transitions to done
    - writeAgentRegistry, writeAgentFile, writeScriptRegistry
    - jest.mock('child_process') and set spawn behavior: for `sh` echo return the LESSON content; for `copilot` return 'done'
  - Act: await runCommand(tmp, 'clean', {})
  - Assert:
    - learningsFile `.raili/main/learnings/test_agent.md` exists and contains parsed lesson content (no Prelude)
    - agent was executed and final state is `done` (loadContext(tmp) last state)

Test sketch:
```typescript
writeWorkflow(tmp, `initial: produce
states:
  produce:
    type: command
    command: |\n      echo "Prelude\nLESSON: This is the lesson\nDetails" 
    output:
      store: true
    teach:
      test_agent:
        - output: produce
    on:
      PASSED: analyze
  analyze:
    type: agent
    agent: test_agent
    prompt: "Review"
    transitions:
      done: done
  done:
    type: engine
`);
spawn.mockImplementation((cmd) => { if (cmd === 'sh') return fakeChild('Prelude\nLESSON: This is the lesson\nDetails\n','',0); if (cmd === 'copilot') return fakeChild('done','',0); return fakeChild('', '', 0); });
await runCommand(tmp, 'clean', {});
const learningsFile = path.join(tmp, '.raili', 'main', 'learnings', 'test_agent.md');
expect(fs.existsSync(learningsFile)).toBe(true);
const stored = fs.readFileSync(learningsFile, 'utf8');
expect(stored).toContain('This is the lesson');
expect(loadContext(tmp).stateHistory.slice(-1)[0].state).toBe('done');
```

### Mock patterns & notes
- Use `jest.mock('child_process', () => ({ spawn: jest.fn() }));` and `const { spawn } = require('child_process');` as in existing tests
- Use `fakeChild(stdout, stderr, exitCode)` for simulated processes
- Use `createTmpWorkspace`, `writeWorkflow`, `writeAgentRegistry`, `writeAgentFile`, `writeScriptRegistry` helpers from `__tests__/integration/testUtils.ts`
- Clean up env vars with `cleanupRailiEnvVars()` in afterEach

## Acceptance Criteria
- [x] `src/types.ts` no longer contains `learn_from` and defines `teach?: Record<string, LearnSource[]>` instead
- [x] `src/runner/agentStateRunner.ts` no longer processes `learn_from` at agent entry; persisted learnings are still injected via readLearningsForPrompt
- [x] Runtime runner executes a Teach phase after feedback and before routing: state.config.teach entries append learnings to agents via appendUniqueLearning
- [ ] Schema and state validation updated: old learn_from validations removed; teach validations added (shape, output reference exists, output.store: true, var pattern)
- [ ] Documentation updated: `documentation/states.md` and `documentation/output.md` no longer mention `learn_from` and include `teach` examples
- [x] Unit and integration tests updated/added and the full test suite passes (npm test)




---

Ticket created from code inspection. See referenced files for precise function names and contexts.

Confirmed: ID=RAI-51, Type=improvement
Saved to: .issues/1_todo/RAI-51-improvement-replace-learn-from-with-teach.md

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>
