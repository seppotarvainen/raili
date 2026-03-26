# Groups

> Embed a sub-workflow as a single state. The sub-workflow is flattened into the parent at load time, sharing context,
> outputs, and learnings. Nesting is limited to one level.

## What Is a Group?

A `group` state references an external YAML file containing a sub-workflow fragment. At load time, Raili flattens the
sub-workflow states into the parent workflow using deterministic ID prefixing (`<groupId>.<subStateId>`). The runner
sees a single flat state machine — groups are a composition mechanism, not a runtime concept.

```yaml
do_review:
  type: group
  group: ./review-flow.yaml
  on:
    PASSED: deploy
    FAILED: rework
```

The sub-workflow file (`review-flow.yaml`) declares `states` but no `initial` — the **first state** in the `states`
map is used as the entry point:

```yaml
states:
  prepare:           # ← entry point (first key in states)
    type: agent
    agent: summarizer
    transitions:
      ready: approve
  approve:
    type: engine
    out: true
```

After flattening, the parent workflow contains states `do_review.prepare` and `do_review.approve` and the original
`do_review` state becomes a proxy engine state that skips into the flattened entry.

## Sub-Workflow Requirements

Sub-workflow files must follow these rules (all validated at startup — fail-fast):

| Rule | Error on violation |
|---|---|
| File must exist at the resolved path | `Group sub-workflow not found: <path>` |
| Must not declare `initial` | First key in `states` is the entry point |
| Must declare at least one `out: true` state | `Sub-workflow must declare at least one 'out: true'` |
| Must not contain `type: group` states | `Sub-workflow must not contain 'group' states` (depth limit = 1) |
| `out: true` states must not define own routing | `'out: true' states must not define routing` |
| No state ID collisions with parent | `State id collision when flattening` |
| No duplicate input keys with parent | `Duplicate input key` |

## The `out: true` Marker

At least one state in the sub-workflow must be marked `out: true`. This marks the exit point where control returns to
the parent workflow. The `out: true` state inherits the routing defined on the parent group state (`on`, `transitions`,
or `approval`).

```yaml
# Sub-workflow: review-flow.yaml
states:
  check:
    type: agent
    agent: checker
    transitions:
      ok: final_review
  final_review:
    type: agent
    agent: reviewer
    out: true          # ← exit point; inherits parent's routing
```

An `out: true` state must **not** define its own `on`, `transitions`, `approval`, `skip`, or `max_visits` — these are
inherited from the parent group state.

## Routing

The group state itself defines how the sub-workflow's exit routes back into the parent. All standard routing options
are supported:

### Binary routing (on:)

```yaml
build_group:
  type: group
  group: ./build-steps.yaml
  on:
    PASSED: test
    FAILED: error
```

The `out: true` state in `build-steps.yaml` inherits `on: {PASSED: test, FAILED: error}`.

### Named routing (transitions:)

```yaml
review_group:
  type: group
  group: ./review-flow.yaml
  transitions:
    approve: merge
    reject: rework
    default: rework
```

The `out: true` state's last stdout line determines which transition key is used.

### Approval routing

```yaml
code_group:
  type: group
  group: ./code-flow.yaml
  approval:
    question: "Accept the implementation?"
    PASSED: deploy
    FAILED: rework
```

After the `out: true` state completes, the user is prompted for approval.

## Flattening Details

When the workflow loader encounters a `type: group` state, it:

1. Resolves the `group` path relative to the workflow directory (e.g., `.raili/main/`)
2. Loads and parses the sub-workflow YAML
3. Validates structure (no nested groups, has `out: true`, no ID collisions)
4. Prefixes all sub-state IDs with `<groupStateId>.` (dot separator)
5. Rewrites internal transitions to use prefixed IDs
6. Copies parent routing (`on`/`transitions`/`approval`) onto each `out: true` state
7. Replaces the group state with a proxy `engine` state that `skip`s to the first flattened sub-state
8. Merges all sub-workflow inputs into the parent's `inputs` (duplicates cause error)

### Example — before and after flattening

**Parent workflow:**
```yaml
initial: start
states:
  start:
    type: engine
    on:
      PASSED: build_group
  build_group:
    type: group
    group: ./build.yaml
    on:
      PASSED: done
  done:
    type: engine
```

**Sub-workflow (build.yaml):**
```yaml
states:
  compile:
    type: command
    command: npm run build
    on:
      PASSED: verify
  verify:
    type: script
    script: run_tests
    out: true
```

**After flattening (runtime state machine):**
```
start                → engine, on: {PASSED: build_group}
build_group          → engine, skip: build_group.compile  (proxy)
build_group.compile  → command, on: {PASSED: build_group.verify}
build_group.verify   → script, on: {PASSED: done}         (inherited from parent)
done                 → engine (terminal)
```

## Shared Context

Parent and sub-workflow states share a single flat context:

- **Variables** — All inputs are merged at startup. Sub-workflow prompts can use `${parent_var}` and vice versa.
  Sub-workflow inputs are declared in the sub-workflow YAML and merged into the parent's `inputs` list.
- **Outputs** — Stored under `.raili/<workflow>/outputs/<groupId>.<subStateId>.md` (the prefixed ID).
- **Learnings** — Stored in the shared `.raili/<workflow>/learnings/` directory.
- **State history** — `context.json` records flattened sequential entries: the proxy state, then each sub-state.

## Resumption

If a run fails mid-sub-workflow, `raili run --continue` resumes from the last entered sub-state. Previously completed
sub-states are not re-executed — they are already in `stateHistory`.

Example: a run that failed at `build_group.verify` resumes from that state on the next run.

## Common Patterns

### Multi-step agent pipeline

```yaml
analyze_group:
  type: group
  group: ./analysis-pipeline.yaml
  transitions:
    approve: implement
    reject: done
```

```yaml
# analysis-pipeline.yaml
states:
  scan:
    type: agent
    agent: scanner
    transitions:
      continue: summarize
  summarize:
    type: agent
    agent: summarizer
    out: true
```

### Reusable build-and-test block

```yaml
ci_group:
  type: group
  group: ./ci-steps.yaml
  on:
    PASSED: deploy
    FAILED: fix
```

```yaml
# ci-steps.yaml
states:
  build:
    type: command
    command: npm run build
    on:
      PASSED: test
  test:
    type: script
    script: run_tests
    out: true
```

### Group with output storage

Sub-states support the same `output:` configuration as top-level states:

```yaml
# sub-workflow
states:
  analyze:
    type: agent
    agent: analyzer
    output:
      store: true
      tail: 100
    transitions:
      done: report
  report:
    type: agent
    agent: reporter
    out: true
```

Outputs are stored at `.raili/<workflow>/outputs/<groupId>.analyze.md`.

## Important Notes

- Groups are **flattened at load time** — the runner never sees `type: group` at runtime
- Nesting is limited to **one level** — sub-workflows must not contain `group` states
- Sub-workflows must not declare `initial` — the first state in the `states` map is the entry point
- The `out: true` state is the **only** exit from a sub-workflow; it must not define its own routing
- All common state fields (`notify`, `output`, `reset_outputs`, `max_visits`, `skip`, `feedback`, `expose`) work on sub-states as expected
- The group proxy state appears in `stateHistory` as a skip entry before the first sub-state

