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

States may declare a `teach:` mapping to push lessons to agents. Learnings are stored under `.raili/learnings/<agentId>.md` and injected into the prompt under a header `## Learnings from previous runs` before agent execution. See documentation/output.md for storage semantics.

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

You may also pass an ordered list of arguments to the script using `args:`. These are forwarded as-is to the spawned process and are the script's responsibility to interpret.

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

### Console presentation (Presenter)

When a state is entered the Runner uses a Presenter to render a boxed, emoji-enhanced header to stdout. The Presenter API is exposed at src/presenter/Presenter.ts and receives: global entry count, uppercase state name, state type, ISO enteredAt timestamp, visit count, and whether learnings were applied (or a "No earlier run output" note). This keeps presentation separate from the Runner's workflow logic.


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

**Routing:** Defined on the group state (`on:`, `transitions:`, or `approval:`). The `out: true` sub-state inherits this routing.

**Flattening:** Sub-state IDs are prefixed with `<groupId>.` (e.g., `build_group.compile`). The group state becomes a proxy engine state that skips to the first sub-state. Context, outputs, and learnings are shared with the parent.

**Constraints:** Sub-workflows must not contain `group` states (depth = 1), must declare `out: true` at least once, and `out: true` states must not define their own routing.

See `documentation/groups.md` for full details on flattening, shared context, resumption, and examples.

## Common State Fields

All states support:

- `notify` — Shell command run when state is entered (before handler)
- `output` — Storage configuration (agent, script, command states)
- `reset_outputs` — Clear outputs from other states on entry
- `max_visits` — Prevent infinite loops (throw on Nth entry)
- `skip` — Optional state id to immediately route to without executing this state. Skipped states do not run notify, do not increment visit counters, and do not produce outputs.

  Note: On `raili run` startup, if any states have `skip` configured, Raili will prompt to confirm skipping these states. Press Enter to accept (skip) or type any input to cancel the run. For tests and CI you may bypass the interactive prompt by setting `RAILI_MANUAL_CHOICE=PASSED` (accept) or `RAILI_MANUAL_CHOICE=FAILED` (decline).

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

| Type    | Routing Options                        | Exit Code               |
|---------|----------------------------------------|-------------------------|
| agent   | transitions (named)                    | Always 0                |
| script  | on (binary) or transitions (named)     | 0 = PASSED, ≠0 = FAILED |
| command | on (binary) or transitions (named)     | 0 = PASSED, ≠0 = FAILED |
| engine  | on, transitions, approval, or terminal | Always PASSED           |
| group   | on, transitions, or approval           | From out:true sub-state |

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

