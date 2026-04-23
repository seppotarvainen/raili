# Ideas

```yaml
title: Refactor `runner.ts` in multiple files
intent: |
  Currenlty ` 
```


```yaml
title: GUI to follow the state machine execution
intent: |
    It would be great to have a simple GUI that shows the state machine execution in real time
    This would allow users to see the current state, the transitions, and the outputs of each state in a more visual way. It would also allow users to interact with the state machine, for example by triggering manual transitions or by providing input for approval states.

    Usage: `raili run --dashboard` would start the workflow execution and open the dashboard in the browser. The dashboard would show the current state, the history of transitions, and the outputs of each state.
```



# Plan: Agent Learning System for Raili

## The Problem

Agents repeat the same mistakes across runs because they have no memory of past failures or corrections. You want agents to *evolve* — accumulating lessons from each workflow cycle so performance trends upward over time.

---

## Core Design: Learnings File (not agent mutation)

You're right to be uncomfortable with mutating agent `.md` files. That's a destructive side-effect on a source-controlled artifact. Instead, introduce a **separate learnings file per agent** that gets *appended to the prompt at runtime* — the same way `previousOutputPath` already works.

```
.raili/
  learnings/
    raili-coding.md      # accumulated lessons for this agent
    issue-ticket-generator.md
```

The agent declaration stays pristine. Learnings are a runtime context injection.

---

## Phase 1: `learn_from` — Declarative Learning Sources

Learning is **opt-in per agent state** via a `learn_from` field in the workflow YAML. The agent state declares exactly where it learns from — no magic, no implicit inference.

### Workflow syntax

```yaml
code:
  type: agent
  agent: raili-coding
  prompt: "Work according to your rules."
  learn_from:
    - output: test          # learn from the test state's stored output
    - output: build         # learn from the build state's stored output
    - var: ${CHECK_DONE_FAILED}  # learn from the human's approval rejection reason
```

Each `learn_from` entry is a **learning source**. Two source types for Phase 1:

| Source | Syntax | Reads from | Example |
|--------|--------|------------|---------|
| `output` | `output: <stateId>` | Latest run in `.raili/outputs/<stateId>.md` | Test failures, build errors |
| `var` | `var: ${VAR_NAME}` | Variable from `context.vars` (set by approval reasons, expose, CLI flags) | Human feedback from approval FAILED |

### How it works at runtime

When an agent state with `learn_from` is entered:

1. **Collect new learnings.** For each source in `learn_from`:
   - `output: test` → Read the latest appended run from `.raili/outputs/test.md` (the text after the last `--- Run ...` separator). If the file doesn't exist or is empty, skip silently.
   - `var: ${CHECK_DONE_FAILED}` → Interpolate the variable from `context.vars`. If the variable is empty/undefined, skip silently.
2. **Deduplicate.** Before appending, check if the normalized content already exists in the learnings file (simple substring match). This prevents identical test output from being recorded on every loop iteration.
3. **Persist.** Append any new learnings to `.raili/learnings/<agentId>.md` with a timestamp and source tag:
   ```markdown
   - [2026-03-18T10:32:00Z] [output:test] Tests failed: "State 'code': agent produced no output..."
   - [2026-03-18T10:32:00Z] [var:CHECK_DONE_FAILED] You didn't follow project conventions for integration tests.
   ```
4. **Inject into prompt.** Load the full `.raili/learnings/<agentId>.md` and append it to the agent's prompt under a `## Learnings from previous runs` header. The agent sees all accumulated learnings, not just the current run's.

### Fail-fast validation

At workflow load time (`registryValidator.ts` / `schemaValidator.ts`):

- `learn_from` is only valid on `type: agent` states
- `output: <stateId>` — validate that the referenced state exists in the workflow and has `output.store: true`. If not → immediate error ("State 'code' declares learn_from output 'test', but state 'test' does not have output.store enabled")
- `var: ${VAR_NAME}` — validate syntax only (must match `${...}` pattern). The variable may not exist until runtime (set by approval/expose), so no existence check.

### What changes

| File | Change |
|------|--------|
| `src/types.ts` | Add `LearnFromSource` interface and `learn_from?: LearnFromSource[]` to `StateConfig` |
| `src/schemas.ts` | Add `learn_from` to `StateConfigSchema` with `validForTypes: ['agent']` |
| `src/learningStore.ts` (new) | `appendLearning(cwd, agentId, text, source)`, `loadLearnings(cwd, agentId): string \| null`, `collectLearnings(cwd, sources, vars): string[]` — core read/write/dedup logic |
| `src/registryValidator.ts` | Add validation: `learn_from` output sources must reference states with `output.store: true` |
| `src/engine/AgentStateRunner.ts` | Before executing: collect learnings from sources → append to store → load full learnings → inject into prompt |
| `src/engine/Engine.ts` | No changes needed — learning is entirely handled inside `AgentStateRunner` |

### Why this design

- **Explicit over implicit.** The user declares exactly what the agent learns from. No engine magic to infer "which agent preceded the approval". This fits Raili's philosophy.
- **Reuses existing infrastructure.** Output store (`.raili/outputs/`) and variable interpolation already exist. `learn_from` just reads from them.
- **No engine changes.** Learning is a concern of `AgentStateRunner`, not the engine. The engine doesn't know about learnings — it just runs states.
- **Fail-fast.** Output source references are validated at load time. You can't accidentally point to a state that doesn't store output.
- **Safe.** Agent `.md` files are never touched. Learnings are a separate append-only sidecar. Delete `.raili/learnings/` to reset.

### Example: how the real workflow would change

Current `code` state:
```yaml
code:
  type: agent
  agent: raili-coding
  prompt: |
    ${CHECK_DONE_FAILED} work according to your rules.
  output:
    store: true
  on:
    PASSED: format
```

With learning enabled:
```yaml
code:
  type: agent
  agent: raili-coding
  prompt: |
    work according to your rules.
  learn_from:
    - output: test
    - output: build
    - var: ${CHECK_DONE_FAILED}
  output:
    store: true
  on:
    PASSED: format
```

Note: `${CHECK_DONE_FAILED}` is removed from the prompt itself because it's now captured as a persistent learning. The agent will see it in the `## Learnings from previous runs` section instead — and it will persist across future runs, not just the current one.

---

## Phase 2: Structured Learnings (categories + dedup)

Raw feedback accumulates noise. Structure it.

### Learnings file format

```markdown
# Learnings for raili-coding

## Testing
- [2026-03-15] Don't put integration tests in __tests__/unit/. Use __tests__/integration/ and follow the fakeChild/spawn mock pattern from existing integration tests.
- [2026-03-18] Always mock child_process in integration tests — never spawn real processes.

## Code Style
- [2026-03-16] Use named exports, not default exports.
```

### How to categorize

Don't auto-categorize with AI initially. Keep it simple:

1. The approval `FAILED` reason is appended as-is with a timestamp under a generic `## Uncategorized` section.
2. Optionally, add a **`raili learn` CLI command** that lets you manually curate the learnings file (move items between categories, rewrite for clarity, delete stale ones). This is a human-in-the-loop refinement step that doesn't need AI.
3. *Later* (Phase 4), you can use an agent to periodically consolidate/rewrite the learnings file.

### Deduplication

Before appending, do a simple substring check — if the same feedback text (normalized) already exists, skip it. This prevents the file from growing unboundedly in loops like `code → test → FAILED → code → test → FAILED`.

---

## Phase 3: Metrics & Trend Detection

I need to know if things are trending in the right direction. For that, I need the following:

Currently `<workflow>/context.json` is wiped on each clean run. To track trends, I need **run log**.

Let's add new file after run: `.raili/<workflow>/run-log.jsonl`

After each workflow completes (terminal state reached), append a summary line:

```json
{
   "runId": "2026-03-18T10:32:00Z",
   "ticket": "RAILI-42",
   "states": 12,
   "loops": 3,
   "approvalFailures": 1,
   "terminalState": "done",
   "successful": true,
   "duration": "4m32s"
}
```

Where:
- **`loops`** = number of times any state was visited more than once (a proxy for rework)
- **`approvalFailures`** = count of `FAILED` approvals (human corrections)
- **`terminalState`** = state where the run ended (`done`, `exit`, etc.)
- **`successful`** = terminal states have success property. If not, this may be omitted or 'undefined', which ever is simpler codewise.

#### Trend command: `raili stats`

```bash
$ raili stats
Last 10 runs:
  Avg loops/run:        2.1 → 1.4  ↓ (improving)
  Approval fail rate:   40% → 20%  ↓ (improving)  
  Success rate:         70% → 90%  ↑ (improving)
  Avg states/run:       14  → 11   ↓ (more efficient)
```

This is the meter you're looking for. No AI required — just arithmetic over the run log.

### Bug tracking integration

You mentioned `.issues/3_done` for bug tickets. A simpler signal: count the ratio of `exit` (failure) terminal states vs `done` (success) terminal states over the last N runs. If the failure rate climbs, learnings aren't helping (or are even hurting).

---

## Phase 4: Agent-Assisted Learning Consolidation (optional, later)

Once you have 20+ raw learnings, they become noise. At this point, introduce an **agent-powered consolidation step**.

### New workflow state (or standalone command): `raili consolidate`

1. Load `.raili/learnings/<agentId>.md`
2. Load the last N entries from `.raili/run-log.jsonl`
3. Ask a consolidation agent: *"Given these raw learnings and run statistics, produce a concise, organized learnings file. Remove duplicates, merge related items, drop anything that's no longer relevant."*
4. Write the result back

This is the only place where an agent modifies learning content — and it's a human-triggered action, not an automatic side-effect. You can diff the result before accepting.

---

## Phase 5: Auto-Feedback from State Outcomes (no human required)

Not all feedback needs to come from approval states. Automated signals:

| Signal | Meaning | Learning |
|--------|---------|----------|
| `code → test → FAILED` | Agent wrote code that doesn't pass tests | Append test output summary as learning context |
| `code → build → FAILED` | Agent wrote code that doesn't compile | Append build errors as learning context |
| `code → test → PASSED → build → PASSED` on first try | Agent got it right | Positive signal (for stats, not learnings) |
| Same state looped 3+ times | Agent is struggling | Flag for human review |

### Implementation

In `Engine.ts`, after a state completes with `FAILED` and routes back to an agent state, check if the failing state has `output.store: true`. If so, extract a summary (first N lines of the output) and append it as a learning tagged with `[auto]`:

```markdown
- [2026-03-18] [auto] Build failed: "Property 'foo' does not exist on type 'Bar'" — ensure type definitions match before using new properties.
```

The `[auto]` tag lets the consolidation step (Phase 4) distinguish human feedback from machine feedback and weight them differently.

Also consider:
- Auto-capture of success patterns (first-try success after prior loops)

---

## Implementation Order (Realistic)

| Phase | Effort | Depends on | Value |
|-------|--------|------------|-------|
| **1: `learn_from` — declarative learning sources + learnings file + prompt injection** | Medium (1-2 tickets) | Nothing | High — immediate improvement loop |
| **2: Structured format + dedup** | Small (1 ticket) | Phase 1 | Medium — prevents noise accumulation |
| **3: Run log + `raili stats`** | Small (1 ticket) | Nothing (independent) | High — gives you the trend meter |
| **4: Agent-assisted consolidation** | Medium (1-2 tickets) | Phases 1+2 | Medium — quality-of-life |
| **5: Auto-feedback from state outcomes** | Medium (1-2 tickets) | Phase 1 | High — removes human from the loop for mechanical errors |

**I'd start with Phase 1 + Phase 3 in parallel.** Phase 1 gives agents memory. Phase 3 gives you visibility. Together they close the loop.

---

## Architecture Fit

This design respects every Raili constraint:

- **No business logic in state definitions** — learning is a handler/engine concern
- **Deterministic core** — learnings are prompt context, not routing logic. Same state machine, same transitions.
- **Fail-fast** — learnings file missing? No error, just no extra context. It's purely additive.
- **No agent mutation** — `.agent.md` files stay read-only. Learnings are a separate, append-only store.
- **Registries unchanged** — no new registry type needed. Learnings are keyed by agent ID but stored independently.
- **Testable** — `learningStore.ts` is a pure module (read/write files), easily mocked. No new external dependencies.

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Learnings file grows unboundedly | Phase 2 dedup + Phase 4 consolidation. Also: `tail` the learnings to last N entries when injecting into prompt. |
| Bad/stale learnings degrade performance | Human curation via `raili learn`. Phase 3 stats will show if performance degrades after adding learnings. |
| Learnings become prompt-length bottleneck | Set a max token/line budget for injected learnings. Prioritize recent entries. |
| Auto-feedback (Phase 5) is noisy | Tag with `[auto]`, let consolidation agent filter. Human can delete. |
| Mutating learnings from inside a run creates non-determinism | Learnings are read at state entry time and written only after completion. Within a single run, the learnings file is effectively frozen per state execution. |

---

## Summary

The minimal viable learning system (Phase 1) is **one new file + updates to four existing files**:

1. **`src/learningStore.ts`** (new) — append/read/dedup learnings per agent
2. **`src/types.ts`** — add `LearnFromSource` interface and `learn_from` to `StateConfig`
3. **`src/schemas.ts`** — add `learn_from` schema field
4. **`src/registryValidator.ts`** — validate `learn_from` output sources reference states with `output.store: true`
5. **`src/engine/AgentStateRunner.ts`** — collect learnings from sources, persist, inject into prompt

The engine itself (`Engine.ts`) requires **no changes** — learning is entirely a concern of the agent state runner. Everything else (stats, consolidation, auto-feedback) layers on top incrementally. Start small, measure with `raili stats`, iterate.

---

# Implementation Tickets

```yaml
title: Add learning system for agents (learn_from)
intent: |
  Add an opt-in learn_from field to agent states in workflow.yaml. This field declares
  explicit sources from which the agent accumulates persistent learnings across runs.
  Learnings are stored in .raili/learnings/<agentId>.md (append-only, timestamped) and
  injected into the agent's prompt under a "## Learnings from previous runs" header on
  every subsequent execution. The agent declaration files are never modified.

  Two source types are supported:

  1. output: <stateId> — reads the latest appended run from .raili/outputs/<stateId>.md
     (text after the last "--- Run ..." separator). At workflow load time, fail-fast validates
     that the referenced state exists and has output.store: true.

  2. var: ${VAR_NAME} — reads a variable value from context.vars at runtime (e.g. an
     approval FAILED reason like ${CHECK_DONE_FAILED}). At load time, only the ${...}
     syntax is validated — the variable may not exist until runtime.

  When an agent state with learn_from is entered:
    a) Each source is checked for content. Missing/empty sources are skipped silently.
    b) New content is deduplicated against the existing learnings file (normalized substring
       match) so looping workflows don't record the same test failure repeatedly.
    c) New learnings are appended to .raili/learnings/<agentId>.md with a timestamp and
       source tag, e.g.: "- [2026-03-18T10:32:00Z] [output:test] Tests failed: ..."
    d) The full learnings file is loaded and appended to the agent's prompt.

  Example workflow YAML:

    code:
      type: agent
      agent: raili-coding
      prompt: "work according to your rules."
      learn_from:
        - output: test
        - output: build
        - var: ${CHECK_DONE_FAILED}
      output:
        store: true
      on:
        PASSED: format

  Implementation touches these files:

  src/types.ts
    - Add LearnFromSource interface: { output?: string; var?: string }
    - Add learn_from?: LearnFromSource[] to StateConfig

  src/schemas.ts
    - Add learn_from entry to StateConfigSchema with type: 'array' and
      validForTypes: ['agent']

  src/learningStore.ts (new file)
    - collectFromOutputSource(cwd, stateId): string | null — reads the latest run
      from .raili/outputs/<stateId>.md (text after last "--- Run" separator). Returns
      null if file missing or empty.
    - collectFromVarSource(varExpr, vars): string | null — interpolates ${VAR_NAME}
      from vars map. Returns null if empty/undefined.
    - isDuplicate(existingContent, newContent): boolean — normalized substring check.
    - appendLearning(cwd, agentId, content, sourceTag): void — appends a timestamped
      entry to .raili/learnings/<agentId>.md. Creates the directory if needed.
    - loadLearnings(cwd, agentId): string | null — returns full file content or null.

  src/registryValidator.ts
    - In validateWorkflowReferences(), add a loop over each state's learn_from entries.
      For output sources: check that the referenced stateId exists in the workflow and
      that its config has output.store === true. Collect errors and include them in the
      fail-fast error message.

  src/engine/AgentStateRunner.ts
    - In run(), after prompt interpolation and before calling executeAgent():
      1. If state.config.learn_from is defined, iterate each source.
      2. Collect content via collectFromOutputSource or collectFromVarSource.
      3. Deduplicate and append new learnings via appendLearning.
      4. Load the full learnings file via loadLearnings.
      5. If learnings exist, append them to resolvedPrompt as:
         "\n\n## Learnings from previous runs\n\n<learnings content>"

  docs/workflow-yaml.md [File removed as redundant (26.3.2026)]
    - Add a learn_from section under "Type: agent" documenting the field, source types,
      runtime behavior, and fail-fast validation.

  documentation/states.md
    - Add learn_from to the agent state documentation.

  Tests:

  __tests__/unit/learningStore.test.ts (new)
    - Test collectFromOutputSource: reads latest run after separator, returns null on missing file
    - Test collectFromVarSource: interpolates variable, returns null on empty
    - Test isDuplicate: matches normalized content, rejects non-matches
    - Test appendLearning: creates directory, appends timestamped entry, creates file on first write
    - Test loadLearnings: returns content or null

  __tests__/unit/agentStateRunner.test.ts (update existing)
    - Test that learnings are collected and injected into prompt when learn_from is defined
    - Test that missing sources are skipped silently (no error thrown)
    - Test that duplicate learnings are not re-appended

  __tests__/unit/registryValidator.test.ts (update existing)
    - Test that learn_from output source referencing a state without output.store: true throws
    - Test that learn_from output source referencing a non-existent state throws
    - Test that learn_from var source with valid ${...} syntax passes validation
    - Test that learn_from on a non-agent state type throws (covered by schema validator)

  __tests__/unit/schemaValidator.test.ts (update existing)
    - Test that learn_from on non-agent type throws SchemaValidationError
    - Test that learn_from with valid structure passes

  __tests__/integration/agent.test.ts (update existing)
    - Add an integration test: agent state with learn_from: [output: test] where the test
      output file exists. Verify that the copilot spawn call includes learnings in the prompt.
      Verify .raili/learnings/<agentId>.md is written to disk.

  Constraints:
    - Engine.ts must NOT be modified. Learning is entirely a concern of AgentStateRunner.
    - Agent .md declaration files must NOT be modified by the learning system.
    - Learnings directory and files are created lazily (only when there is content to write).
    - Empty/missing sources must be skipped silently — never throw on missing learning data.
    - The learn_from field is optional. States without it behave exactly as before.
```


+----------------------------------------------------------------------------------------------+
|  🤖 #1 CODING                                                                                |
+---------------------------------------------------------------------------------------------+

```yaml
title: Print state end summary after each state execution
intent: |
   For example I'd like to see {suitable emoji} + PASSED/FAILED if it uses type "on". 
   For transitions it could just use {arrow emoji} + transition key -> next state.
   
   Use presenter to handle this. You should have a separate method where you put this stuff.
   After things are there, call presenter's render method.
   
   This is an example of what I want to see after state execution:
   
   -----------------------------------------
   ✅ PASSED -> test | ⏱️Elapsed time: 2:28
```

   