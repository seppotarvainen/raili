# States

> Five state types: agent (Copilot agents), script (shell scripts), command (inline commands), engine (no-op), group
> (embedded sub-workflow). Each has different routing rules.

## Type: agent

Runs a Copilot agent from `.github/agents/`. Agents read and understand prompts, iterate, and output decision keys.

```yaml
analyze:
  type: agent
  agent: analyzer
  model: gpt-4o
  prompt: "Analyze ticket ${ticket_id}"
  output:
    store: true
  transitions:
    ready: code
    blocked: done
    default: done  # optional catch-all mapping

    # Note: if the state outputs a key not explicitly listed above, the engine will attempt to resolve it;
    # if transitions.default is present it will be used as a catch-all. If default is absent the engine fails fast.
```

States may declare a `teach:` mapping to push lessons to agents. By default learnings are written to the global store at `.raili/learnings/<agentId>.md` and are merged with any workflow-local learnings when injected into agent prompts (workflow-local lessons override duplicates). To keep a lesson local to a workflow, include `scope: workflow` on the teach source. See `documentation/output.md` for details and examples.

Validation note: Teach mappings are validated during workflow load. If a state's `teach:` block references an agent ID not present in `agent-registry.json`, the loader fails fast and reports the offending state and agent ID. The `raili teach` CLI command performs the same check and will error when the specified agent is not registered.

When a state declares `teach:` and also uses `approval:`, approval-exposed variables (for example `CHECK_DONE_FAILED` or `REVIEW_FAILED`) are written into `context.vars` before the state's `teach:` mappings are processed. This allows `teach:` entries on the same state to reference approval-produced variables (e.g. `${REVIEW_FAILED}`) so learnings can be created directly from user-provided approval reasons in the originating state.

**Fields:**

- `agent` (required) — Agent ID from agent-registry.json
- `model` (optional) — Override model (e.g., gpt-4o, claude-sonnet)
- `prompt` (optional) — Instruction for agent. Default: "Work according to your rules"
- `output` (optional) — Storage and filtering config

- NOTE: Inputs may be declared as shorthand strings (e.g. `- ticket_id`) or as objects with `name` and an optional `description`. See documentation/variables.md for details.

**Routing:** Use `transitions:` (not `on:`), agent prints outcome key as last line.

**Memory:** With `output.store: true`, previous output is appended to prompt on next run.

## Type: script

Executes a shell script from script-registry.json. Exit code determines routing.

```yaml
test:
  type: script
  script: run_tests
  on:
    PASSED: success
    FAILED: rework
```

You may also pass an ordered list of arguments to the script using `args:`. Values in `args:` are interpolated for `${VARIABLE}` placeholders using the workflow's variables before the script is spawned. The engine fails fast if any referenced variable is missing. Use literal `$RAILI_VAR_<UPPERCASE>` when you want the shell-visible env var preserved.

```yaml
my_script_state:
  type: script
  script: run_tests
  args:
    - 'This is the first argument'
    - '--verbose'
  on:
    PASSED: success
    FAILED: rework
```

**Fields:**

- `script` (required) — Script ID from script-registry.json
- `args` (optional) — Ordered list of strings forwarded to the script process

**Routing:** Use `on:` (binary) or `transitions:` (named).

You may declare `expose: [name]` on `script` and `command` states to extract `name=value` from stdout and export it as `$RAILI_VAR_NAME` for later states. The engine validates declared `expose` names are produced and will throw (fail-fast) if any are missing.

## Type: command

Runs an inline shell command. Exit code determines routing.

```yaml
build:
  type: command
  command: npm run build
  directory: ./app
  on:
    PASSED: test
    FAILED: error
```

**Fields:**

- `command` (required) — Shell command to execute
- `directory` (optional) — Working directory (defaults to project root)

**Routing:** Use `on:` (binary) or `transitions:` (named).

## Type: engine


No-op state — performs no side effects. Useful as branching point, entry state, or terminal state.

```yaml
start:
  type: engine
  reset_outputs:
    - code
    - test
  on:
    PASSED: analyze

done:
  type: engine
  notify: "msg.sh 'Complete'"
  # Optional: explicit success signal for terminal engine states
  # If provided, the engine will persist this boolean into .raili/context.json
  # as the state's `meta.success` value for the run. When omitted the value
  # recorded will be null.
  success: true
```

**Always returns:** PASSED

**Use cases:**

- Clear outputs at cycle start
- Branch between multiple workflows
- Terminal state with notification
- No-op before another state

## Type: group

## Continue vs Terminal states

Raili supports an unconditional routing option `continue:` that can be declared on any state. When present, the engine will route to the specified target state immediately after the state's handler phase, ignoring exit codes or reported outcomes.

Key distinctions:

- `continue` is unconditional and routes regardless of success/failure or reported outcome.
- A terminal state defines no routing (`on:`, `transitions:`, or `approval:` absent) — the workflow stops there.
- `continue` is mutually exclusive with `on:`, `transitions:`, and `approval:`. Workflow validation will fail if multiple routing mechanisms are present on the same state.

Example:

```yaml
check:
  type: script
  script: health_check
  continue: finish

finish:
  type: engine
```


Embeds a sub-workflow YAML file as a single state. The sub-workflow is flattened into the parent at load time — the runner sees a single flat state machine. Nesting is limited to one level.

```yaml
build_group:
  type: group
  group: ./build-steps.yaml
  on:
    PASSED: deploy
    FAILED: rework
```

The referenced sub-workflow declares states but no `initial`. At least one state must be marked `out: true` — this is the exit point that inherits the parent's routing.

```yaml
# build-steps.yaml
states:
  compile:
    type: command
    command: npm run build
    on:
      PASSED: test
  test:
    type: script
    script: run_tests
    out: true
```

**Fields:**

- `group` (required) — Relative path to sub-workflow YAML file (relative to workflow directory)

**Routing:** Defined on the group state (`on:`, `transitions:`, `approval`, or `continue:`). The `out: true` sub-state inherits this routing.

**Flattening:** Sub-state IDs are prefixed with `<groupId>.` (e.g., `build_group.compile`). The group state becomes a proxy engine state that skips to the first sub-state. Context, outputs, and learnings are shared with the parent.

**Constraints:** Sub-workflows must not contain `group` states (depth = 1), must declare `out: true` at least once, and `out: true` states must not define their own routing (including `continue`).

See `documentation/groups.md` for full details on flattening, shared context, resumption, and examples.

## Common State Fields

All states support:

- `notify` — Shell command run when state is entered (before handler)
- `output` — Storage configuration (agent, script, command states)
- `reset_outputs` — Clear outputs from other states on entry (deletes both `<state>.md` and `<state>.latest.md`). Use to reset agent memory when starting a new cycle.
- `max_visits` — Prevent infinite loops (throw on Nth entry)
- `skip` — Optional state id to immediately route to without executing this state. Skipped states do not run notify, do not increment visit counters, and do not produce outputs.

  Note: On `raili run` startup, if any states have `skip` configured, Raili will prompt to confirm skipping these states. Press Enter to accept (skip) or type any input to cancel the run. For tests and CI you may bypass the interactive prompt by setting `RAILI_MANUAL_CHOICE=PASSED` (accept) or `RAILI_MANUAL_CHOICE=FAILED` (decline). The `--dry-run` flag implicitly accepts skip confirmations (treats them as accepted) because dry-run is non-interactive and intended for CI validation.

## Persisted State History (context.json)

Each state entry recorded to `.raili/context.json` includes a minimal history record and optional structured metadata to aid debugging and UI building. Example entry shape:

{
  state: "analyze",
  enteredAt: "2026-03-16T12:00:00Z",
  meta: {
    notify: { command: "slack-notify \"done\"", success: true, exitCode: 0 },
    approval: { question: "Looks good?", chosen: "PASSED", reason: "" }
  }
}

Metadata is optional and extensible; older context files lacking `meta` continue to be supported.

## State Transitions Summary

| Type    | Routing Options                                         | Exit Code               |
|---------|---------------------------------------------------------|-------------------------|
| agent   | `transitions:` (named) or `continue:` (unconditional)   | Always 0                |
| script  | `on:` (binary), `transitions:` (named), or `continue:`  | 0 = PASSED, ≠0 = FAILED |
| command | `on:` (binary), `transitions:` (named), or `continue:`  | 0 = PASSED, ≠0 = FAILED |
| engine  | `on:`, `transitions:`, `approval:`, `continue:`, or terminal | Always PASSED     |
| group   | `on:`, `transitions:`, `approval:`, or `continue:`      | From out:true sub-state |

**Note:** Agents may use `on`, but agent handlers currently always return `PASSED`; for multi-outcome use `transitions`.

## Preventing Infinite Loops

Use `max_visits` to hard-stop looping states:

```yaml
code:
  type: agent
  max_visits: 5
  output:
    store: true
  on:
    PASSED: test
    FAILED: code  # loops back, but throws on 6th entry
```

Engine throws immediately on exceeding limit (before any side effects).

### Resetting max_visits for nested loops

When designing nested loops (an inner loop inside an outer loop), you may want the inner state's visit counter to reset each time the outer loop runs. Use `reset_max_visits` on the outer state to list downstream state IDs whose in-memory visit counters should be cleared when the outer state is entered.

Example:

```yaml
initial: loop_outer
states:
  loop_outer:
    type: command
    command: echo "Outer loop iteration"
    reset_max_visits:
      - loop_inner
    on:
      PASSED: loop_inner
      FAILED: error_state

  loop_inner:
    type: command
    command: echo "Inner loop iteration"
    max_visits:
      count: 3
    on:
      PASSED: loop_inner  # loops back, resets after 3 attempts
      FAILED: loop_outer

  error_state:
    type: engine
```

Expected behavior: each time `loop_outer` is entered it clears the visit counter for `loop_inner`, allowing `loop_inner` to run up to its `max_visits` limit per outer iteration.

Validation: targets listed in `reset_max_visits` are verified at workflow load time. If a listed state ID does not exist the loader will fail-fast with a validation error (for example: `unknown state 'nowhere'`).

Persistence: `reset_max_visits` clears only in-memory visit counters maintained during a run. Visit counts are not persisted to `.raili/context.json`, so on workflow resume visit counters are naturally reset.

