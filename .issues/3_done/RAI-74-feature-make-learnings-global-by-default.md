# RAI-74: Make learnings global by default

**Type:** feature

## Description

Implement a hybrid global-then-local learnings system to reduce confusion and improve agent reuse across workflows. Currently, learnings are workflow-specific (stored at `.raili/<workflow>/learnings/<agent_id>.md`), which means agents don't carry knowledge between workflows. This feature introduces a global learnings layer (`.raili/learnings/<agent_id>.md`) that is consulted by all workflows, with optional workflow-level overrides for specific scenarios.

**Key behavior:**
- Learnings default to global scope (`.raili/learnings/<agent_id>.md`)
- If a workflow-local learnings file exists (`.raili/<workflow>/learnings/<agent_id>.md`), both global and local learnings are merged when injected into agent prompts (local wins on conflicts, duplicates removed)
- The `teach:` mechanism writes to global by default; add optional `scope: workflow` to keep lessons local
- Directory structure enables cross-workflow knowledge accumulation while preserving workflow-specific customization

## Documentation References
- documentation/output.md (learnings section)
- documentation/states.md (teach mechanism)

## Code References
- src/context/pathUtils.ts (learningsFilePath function)
- src/context/learningStore.ts (readLearnings, readLearningsForPrompt, appendUniqueLearning, appendManualLearning)
- src/runner/agentStateRunner.ts (readLearningsForPrompt call)
- src/runner/runner.ts (handleTeach method)
- src/cli/teach.ts (teachCommand function)
- src/types.ts (StateConfig.teach definition)

## Implementation Plan

Read existing code before implementing each step.

1. **src/context/pathUtils.ts** — Update `learningsFilePath()` function:
   - Currently: resolves to `.raili/<workflow>/learnings/<agent_id>.md`
   - Change to: take an optional `scope?: 'global' | 'workflow'` parameter (defaults to `'global'`)
   - When `scope === 'global'`: resolve to `.raili/learnings/<agent_id>.md` (root level)
   - When `scope === 'workflow'`: resolve to `.raili/<workflow>/learnings/<agent_id>.md` (current behavior)
   - Update JSDoc to clarify the new parameter and behavior

2. **src/context/learningStore.ts** — Update all learnings functions:
   - Update `readLearnings(cwd, agentId, workflowArg?, scope?)` to accept scope parameter
   - Update `readLearningsForPrompt(cwd, agentId, workflowArg?, scope?)` to accept scope parameter and add new function `readMergedLearnings(cwd, agentId, workflowArg?)` that:
     - Reads global learnings via `readLearnings(cwd, agentId, undefined, 'global')`
     - Reads workflow learnings via `readLearnings(cwd, agentId, workflowArg, 'workflow')`
     - Merges both, deduplicating by normalized lesson content (workflow takes precedence on duplicates)
     - Returns merged content
   - Add `readMergedLearningsForPrompt(cwd, agentId, workflowArg?)` that wraps `readMergedLearnings()` and returns timestamp-stripped, prompt-ready format
   - Update `appendUniqueLearning(cwd, agentId, sourceTag, content, workflowArg?, scope?)` to accept scope parameter (default `'global'`)
   - Update `appendManualLearning(cwd, agentId, content, workflowArg?, scope?)` to accept scope parameter (default `'global'`)

3. **src/runner/agentStateRunner.ts** — Update to use merged learnings:
   - Replace `readLearningsForPrompt(cwd, agentId, workflowArg)` with `readMergedLearningsForPrompt(cwd, agentId, workflowArg)`
   - No other changes needed to agentStateRunner; the new learnings function handles merging transparently

4. **src/types.ts** — Add scope to teach mechanism:
   - Update `LearnSource` type to optionally include `scope?: 'global' | 'workflow'`:
     - `export type LearnSource = { output: string; scope?: 'global' | 'workflow' } | { var: string; scope?: 'global' | 'workflow' };`
   - Update JSDoc to clarify scope defaults to `'global'`

5. **src/runner/runner.ts** — Update teach phase to respect scope:
   - In `handleTeach()` method, when appending lessons, pass the `scope` from the teach entry (or default to `'global'`):
     - For `output` entries: `appendUniqueLearning(this.cwd, agentId, sourceTag, content, this.workflowArg, entry.scope ?? 'global')`
     - For `var` entries: `appendUniqueLearning(this.cwd, agentId, sourceTag, val, this.workflowArg, entry.scope ?? 'global')`

6. **src/workflow/schemas.ts** — Update teach schema to include scope:
   - Update teach schema definition to allow `scope: 'global' | 'workflow'` as an optional field on each source entry
   - Example field structure:
     ```typescript
     scope: {
       required: false,
       type: 'string',
       enum: ['global', 'workflow'],
       description: 'Scope for storing lessons: "global" (default) shares across workflows, "workflow" keeps local to this workflow'
     }
     ```

7. **src/cli/teach.ts** — Update manual teach command:
   - Add optional `--scope global|workflow` flag (default: `'global'`)
   - When calling `appendManualLearning()`, pass the scope parameter based on flag
   - Update help text to document the new flag

8. **src/workflow/workflowLoader.ts** — Validate scope values:
   - In teach validation, ensure any `scope` values in entries are either `'global'` or `'workflow'` (fail-fast if invalid)

9. **Documentation** — Update docs:
   - **documentation/output.md**: Update "Learnings (opt-in)" section to describe:
     - Global learnings at `.raili/learnings/<agent_id>.md`
     - Workflow-local overrides at `.raili/<workflow>/learnings/<agent_id>.md`
     - Merge behavior (both consulted, local wins on conflict)
     - Example directory structure
     - How to use `scope:` in teach entries
   - **documentation/states.md**: Update teach example to show scope usage:
     ```yaml
     states:
       train:
         type: command
         command: python train.py
         output:
           store: true
         teach:
           my_agent:
             - output: train
               scope: global  # (or omit to default to global)
           other_agent:
             - var: "${TRAINING_NOTES}"
               scope: workflow  # keep this learning local to this workflow
     ```

## Examples

### Directory structure after implementation
```
.raili/
  learnings/
    raili-coding.md           # Global lessons for raili-coding agent (used by all workflows)
    qa-tester.md              # Global lessons for qa-tester agent

  main/
    learnings/
      raili-coding.md         # (optional) Main-specific overrides/additions for raili-coding
    workflow.yaml

  qa/
    learnings/
      raili-coding.md         # (optional) QA-specific overrides/additions for raili-coding
    workflow.yaml

  other/
    workflow.yaml
```

### Teach mechanism with scope
```yaml
states:
  code_review:
    type: command
    command: python review.py
    output:
      store: true
    teach:
      raili-coding:
        - output: code_review           # Defaults to global scope
        - var: "${BEST_PRACTICES}"
          scope: workflow               # Keep these practices local to this workflow
```

### Expected behavior

**Before:**
- Agent in workflow "qa" learns something → lesson stored at `.raili/qa/learnings/raili-coding.md`
- Same agent used in workflow "main" → sees only `.raili/main/learnings/raili-coding.md` (missing qa learnings)

**After:**
- Agent in workflow "qa" learns something → lesson stored at `.raili/learnings/raili-coding.md` (global)
- Same agent used in workflow "main" → sees `.raili/learnings/raili-coding.md` (global) + `.raili/main/learnings/raili-coding.md` (local override if exists)
- If agent prompt receives same lesson from both global and local, duplicate is removed; local version takes precedence

### Teach CLI command
```bash
# Default: writes to global
raili teach raili-coding

# Explicit scope specification (future CLI enhancement)
raili teach raili-coding --scope workflow  # Writes to .raili/<workflow>/learnings/raili-coding.md
```

## Test Plan

### Unit tests (`__tests__/unit/`)

**File:** `__tests__/unit/context/learningStore.test.ts`

- **Test case:** "readMergedLearnings() merges global and workflow learnings"
  - Setup: 
    - Create global learnings file: `.raili/learnings/agent1.md` with content: `- [TIMESTAMP] [manual] Global lesson`
    - Create workflow learnings file: `.raili/main/learnings/agent1.md` with content: `- [TIMESTAMP] [manual] Local lesson`
  - Act: `readMergedLearnings(cwd, 'agent1', 'main')`
  - Assert: returns both lessons (deduplicated if identical)

- **Test case:** "readMergedLearnings() prioritizes workflow learnings on conflict"
  - Setup:
    - Global: `- [TIMESTAMP] [manual] Lesson content`
    - Workflow: `- [TIMESTAMP] [manual] Lesson content` (identical when normalized)
  - Act: `readMergedLearnings(cwd, 'agent1', 'main')`
  - Assert: returns single entry (duplicate removed); order preserved (workflow first if both present)

- **Test case:** "readMergedLearningsForPrompt() returns prompt-ready format"
  - Setup: merged learnings with timestamps
  - Act: `readMergedLearningsForPrompt(cwd, 'agent1', 'main')`
  - Assert: returns bullet-point formatted string with timestamps stripped, source tags removed

- **Test case:** "appendUniqueLearning() with scope='global' writes to root learnings"
  - Setup: cwd and agentId
  - Act: `appendUniqueLearning(cwd, 'agent1', 'output:state1', 'lesson', 'main', 'global')`
  - Assert: file created at `.raili/learnings/agent1.md` (not `.raili/main/learnings/agent1.md`)

- **Test case:** "appendUniqueLearning() with scope='workflow' writes to workflow learnings"
  - Setup: cwd and agentId
  - Act: `appendUniqueLearning(cwd, 'agent1', 'output:state1', 'lesson', 'main', 'workflow')`
  - Assert: file created at `.raili/main/learnings/agent1.md`

**File:** `__tests__/unit/runner/runner.test.ts`

- **Test case:** "handleTeach() respects scope parameter in teach entries"
  - Setup: Mock appendUniqueLearning
  - Act: Call runner with teach entry: `{ output: 'state1', scope: 'workflow' }`
  - Assert: appendUniqueLearning called with `scope = 'workflow'`

**File:** `__tests__/unit/types/teach.test.ts` (new file if needed)

- **Test case:** "LearnSource allows optional scope field"
  - Setup: Define teach entry with and without scope
  - Assert: Both compile and pass type validation

### Integration tests (`__tests__/integration/`)

Follow patterns from `__tests__/integration/testUtils.ts`:

**Test case:** "Learnings shared globally across workflows"
```typescript
// Setup two workflows: 'main' and 'qa'
writeNamedWorkflow(tmp, 'main', `
initial: produce
states:
  produce:
    type: command
    command: |
      echo "Command output
      LESSON: Check all edge cases"
    output:
      store: true
    teach:
      agent1:
        - output: produce  # Defaults to global
    on:
      PASSED: analyze
  analyze:
    type: agent
    agent: agent1
    prompt: "Review"
    transitions:
      done: done
  done:
    type: engine
`);

writeNamedWorkflow(tmp, 'qa', `
initial: use_learning
states:
  use_learning:
    type: agent
    agent: agent1
    prompt: "Run QA"
    transitions:
      done: done
  done:
    type: engine
`);

// Mock spawn
spawn.mockImplementation((cmd: string) => {
  if (cmd === 'sh' && args[1].includes('echo')) {
    return fakeChild('Command output\\nLESSON: Check all edge cases\\n', '', 0);
  }
  if (cmd === 'copilot') {
    // Agent is called twice: in 'main' after produce, and in 'qa'
    return fakeChild('done', '', 0);
  }
  return fakeChild('', '', 0);
});

// Run main workflow
await runCommand(tmp, 'clean', { workflow: 'main' });

// Assert: global learnings created
const globalLearnings = path.join(tmp, '.raili', 'learnings', 'agent1.md');
expect(fs.existsSync(globalLearnings)).toBe(true);
expect(fs.readFileSync(globalLearnings, 'utf8')).toContain('Check all edge cases');

// Run qa workflow (clean)
await runCommand(tmp, 'clean', { workflow: 'qa' });

// Assert: second agent run in qa workflow sees global learnings
const copilotCalls = spawn.mock.calls.filter((c: any[]) => c[0] === 'copilot');
expect(copilotCalls.length).toBeGreaterThanOrEqual(2);
// Check that the copilot call in 'qa' includes learnings in the prompt (would need to inspect args or mock behavior)
```

**Test case:** "Workflow-local learnings override global when present"
```typescript
writeWorkflow(tmp, `
initial: analyze
states:
  analyze:
    type: agent
    agent: agent1
    prompt: "Review"
    transitions:
      done: done
  done:
    type: engine
`);

// Pre-populate learnings
fs.mkdirSync(path.join(tmp, '.raili', 'learnings'), { recursive: true });
fs.writeFileSync(
  path.join(tmp, '.raili', 'learnings', 'agent1.md'),
  '- [2024-01-01T00:00:00Z] [manual] Global: Always validate input\n',
  'utf8'
);

fs.writeFileSync(
  path.join(tmp, '.raili', 'main', 'learnings', 'agent1.md'),
  '- [2024-01-02T00:00:00Z] [manual] Local: Use specific test harness\n',
  'utf8'
);

spawn.mockImplementation((cmd: string) => {
  if (cmd === 'copilot') return fakeChild('done', '', 0);
  return fakeChild('', '', 0);
});

await runCommand(tmp, 'clean', {});

// Assert: copilot called with both global and local learnings (inspect call args or mock readMergedLearningsForPrompt)
```

**Test case:** "teach with scope='workflow' writes to workflow learnings"
```typescript
writeWorkflow(tmp, `
initial: produce
states:
  produce:
    type: command
    command: |
      echo "Output
      LESSON: This is workflow-specific"
    output:
      store: true
    teach:
      agent1:
        - output: produce
          scope: workflow  # Explicit local scope
    on:
      PASSED: done
  done:
    type: engine
`);

spawn.mockImplementation((cmd: string) => {
  if (cmd === 'sh') {
    return fakeChild('Output\\nLESSON: This is workflow-specific\\n', '', 0);
  }
  return fakeChild('', '', 0);
});

await runCommand(tmp, 'clean', {});

// Assert: lesson written to workflow learnings (not global)
const workflowLearnings = path.join(tmp, '.raili', 'main', 'learnings', 'agent1.md');
const globalLearnings = path.join(tmp, '.raili', 'learnings', 'agent1.md');
expect(fs.existsSync(workflowLearnings)).toBe(true);
expect(fs.existsSync(globalLearnings)).toBe(false);
```

## Acceptance Criteria

- [ ] Global learnings file created at `.raili/learnings/<agent_id>.md` by default
- [ ] `teach:` mechanism appends to global learnings by default (backwards compatible for existing teach entries without scope)
- [ ] When workflow-local learnings exist, both global and local are merged and injected into agent prompts
- [ ] Workflow-local learnings take precedence over global when duplicate lessons exist
- [ ] Optional `scope: workflow` in teach entries routes lessons to workflow-specific file
- [ ] `readMergedLearningsForPrompt()` returns deduplicated, formatted prompt text
- [ ] All existing tests pass
- [ ] New unit tests verify merging logic and scope handling
- [ ] Integration test validates cross-workflow learnings sharing and local overrides
- [ ] Documentation updated with examples and directory structure
- [ ] `raili teach` command still works and defaults to global scope
