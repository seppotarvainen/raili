# Routing

> A state must have EXACTLY ONE of: on, transitions, or approval. Binary (on:) maps exit codes. Named (transitions:)
> maps outcome keys. Approval prompts the user.

## Binary Routing (on:)

Maps exit codes to next states. Code 0 = PASSED, non-zero = FAILED.

```yaml
on:
  PASSED: next_state      # exit code 0
  FAILED: error_state     # exit code non-zero
```

**Use for:** script, command states

**NOT suitable for agents** — Copilot agents always exit code 0.

## Named Routing (transitions:)

Maps outcome keys (from last line of stdout) to next states. The agent/script/command must print the key as its last
line.

```yaml
transitions:
  approve: merge_state
  reject: fix_state
  blocked: done
```

A reserved `default` key may be provided as a catch-all mapping that will be used when the state's reported outcome does not match any explicit key. When `default` is present the engine routes to that state; when absent an unmapped outcome throws an error (fail-fast).

Note: state runners (agent/script/command) return only their reported outcome key — they must not attempt to resolve routing. The Engine (thin core) is responsible for mapping outcome keys to states and will apply `transitions.default` as a catch-all when present. This keeps routing centralized and deterministic.

```yaml
transitions:
  approve: merge_state
  reject: fix_state
  default: done   # catch-all for unknown outcomes
```

**Use for:** agent, script, command states

**MUST use for agents** — this is the correct routing mechanism.

## Manual Approval (approval:)

Pauses execution and prompts the user for yes/no.

```yaml
approval:
  question: "Proceed with deployment?"
  notify: "alert.sh"      # Optional: run before prompt
  PASSED: deploy          # user approves (Enter)
  FAILED: rework          # user rejects (type anything)
```

**Use for:** any state type

## Terminal State

No `on`, `transitions`, `approval`, or `continue` defined. Workflow stops here.

```yaml
done:
  type: engine
  notify: "echo 'Complete'"
```

## Error State

Raili supports an optional top-level `error:` field that names a state to which the engine will deterministically route if an unhandled exception escapes the normal state handler/routing logic.

**Declaration:**

```yaml
initial: start
error: error_state    # ← routes here on unexpected failure

states:
  start:
    type: agent
    agent: main_logic
    transitions:
      ready: done

  error_state:
    type: engine
    notify: "alert.sh 'Workflow failed'"
```

**Key points:**

- `error:` is optional. If present, its value must be a valid state ID defined under `states:`
- The declared error state must be **terminal**: it cannot have `on:`, `transitions:`, or `approval:`
- The error state behaves like any other state on entry: `reset_outputs` and `notify` run (if present), then execution stops
- `notify` on the error state is best-effort: failures do not crash further
- The engine appends the error state to context history, so runs remain auditable

**Why use an error state?**

- Provides a single place to handle unexpected failures (e.g., send alerts, cleanup, record messages)
- Keeps the engine thin: instead of trying to recover automatically, route to a known state
- All errors are persisted to context.json for auditability and debugging

## Important Notes

- Agents always exit code 0 regardless of internal logic → use `transitions:` not `on:`
- A state may not have multiple routing options — exactly one required
- Missing routing key in `transitions:` → workflow error
- Variables can be used in approval questions with `${variable_name}` syntax
- `skip` may be used to bypass a state and immediately route to another state without running handlers. Use with care to avoid hiding important checks.
- **Group states** define routing on the parent group (`on:`, `transitions:`, or `approval:`). The sub-workflow's `out: true` state inherits this routing. See `documentation/groups.md` for details.

## Unconditional Routing (continue:)

Raili supports an unconditional routing option `continue:` that, when present, will route to the specified state immediately after the state's handler phase, regardless of the outcome or exit code. This is useful when a state performs side-effectful work but the next step should not depend on its result.

Key points:

- `continue` is mutually exclusive with `on:`, `transitions:`, and `approval:` — workflows must declare exactly one routing mechanism per state.
- For `script` and `command` states, `continue` ignores the exit code (both success and failure will route to the `continue` target).
- For `agent` states, `continue` ignores the agent's reported outcome and routes unconditionally.
- If the `continue` target references an unknown state ID this is a workflow validation error (fail-fast during load/build).

Example usage:

```yaml
states:
  build:
    type: script
    script: run_build
    continue: test

  analyze:
    type: agent
    agent: analyzer
    continue: review
```

Use `continue` sparingly; when you actually need branching based on results prefer `on:` or `transitions:` to keep workflows explicit and deterministic.

