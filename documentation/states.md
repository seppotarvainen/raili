# States

> Four state types: agent (Copilot agents), script (shell scripts), command (inline commands), engine (no-op). Each has
> different routing rules.

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
```

**Fields:**

- `agent` (required) — Agent ID from agent-registry.json
- `model` (optional) — Override model (e.g., gpt-4o, claude-sonnet)
- `prompt` (optional) — Instruction for agent. Default: "Work according to your rules"
- `output` (optional) — Storage and filtering config

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

**Fields:**

- `script` (required) — Script ID from script-registry.json

**Routing:** Use `on:` (binary) or `transitions:` (named).

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
```

**Always returns:** PASSED

**Use cases:**

- Clear outputs at cycle start
- Branch between multiple workflows
- Terminal state with notification
- No-op before another state

## Common State Fields

All states support:

- `notify` — Shell command run when state is entered (before handler)
- `output` — Storage configuration (agent, script, command states)
- `reset_outputs` — Clear outputs from other states on entry
- `max_visits` — Prevent infinite loops (throw on Nth entry)

## State Transitions Summary

| Type    | Routing Options                        | Exit Code               |
|---------|----------------------------------------|-------------------------|
| agent   | transitions (named)                    | Always 0                |
| script  | on (binary) or transitions (named)     | 0 = PASSED, ≠0 = FAILED |
| command | on (binary) or transitions (named)     | 0 = PASSED, ≠0 = FAILED |
| engine  | on, transitions, approval, or terminal | Always PASSED           |

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

