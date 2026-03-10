# Raili Development & Usage Guide

# Architectural Principles

- Only "agents" perform cognitive tasks.
- Only "scripts" and command perform shell operations.
- State "engine" is only used for convenience states with no side effects. They'll always return `PASSED`.
- Manual approval is inline: a state with an `approval` block in `workflow.yaml` automatically pauses the engine for user confirmation.
- Binary outcomes use `on: PASSED/FAILED` (exit code). Named outcomes use `transitions:` (last stdout line). A state may not have both.
- Engine controls all transitions deterministically.

`workflow.yaml` lives in `.raili/` and defines the entire state machine — states, transitions, agents, scripts, notifications, and approval prompts.

---

# Workflow YAML Reference

## Top-level fields

| Field | Type | Required | Description |
|---|---|---|---|
| `initial` | string | ✅ | The state the workflow starts from |
| `error` | string | ❌ | Optional ID of a terminal state to route to if the engine encounters an unhandled exception during execution |
| `states` | map | ✅ | All state definitions, keyed by state ID |
| `inputs` | string[] | ❌ | Declared input names. On a clean run, Raili prompts for any that are not supplied via `--var` flags |
| `include` | string[] | ❌ | Paths to sub-workflow YAML files, relative to `.raili/`. States are merged in — no duplicate IDs allowed |

---

## Error state

Raili supports an optional top-level `error:` field that names a state to which the engine will deterministically route if an unhandled exception escapes the normal state handler/routing logic.

Key points:

- `error` is optional. If present, its value must be the ID of a state defined under `states:`.
- The declared error state must be terminal: it must NOT have `on:`, `transitions:`, or an `approval:` block. The workflow validator enforces this (fail-fast).
- The error state behaves like any other state on entry: the engine will run its `reset_outputs` and `notify` entry actions (if present) and then stop — the error state is always treated as terminal.
- `notify` on the error state is best-effort: failures while running the notification do not crash the engine further.

Why use an `error` state?

- Provides a single place to handle unexpected failures (for example: send a Slack/email notification, run a cleanup script, or record a human-facing message).
- Keeps the engine thin and deterministic: instead of trying to recover automatically, the engine routes to a known state where you can surface and handle the failure.

Example — declare an error state for notifications and cleanup:

```yaml
initial: start
error: error_state

states:
  start:
    type: command
    command: ./run-workflow.sh

  error_state:
    type: engine
    notify: "msg.sh 'Workflow failed — please investigate'"
    reset_outputs:
      - code
```

Notes on behavior

- The engine will append the `error_state` to the context history and persist `context.json` so runs are auditable and you can resume after addressing the problem.
- The `error` state cannot perform routing — it is intentionally terminal. If you need human intervention then a separate `approval:` block on a different state is the right place for it.

---

## State fields

Every key under `states:` is a **state ID**. Each state has the following fields:

### Core

| Field | Type | Required | Description |
|---|---|---|---|
| `type` | string | ✅ | One of `agent`, `script`, `command`, `engine` |
| `on` | map | ❌ | Binary routing: maps `PASSED` and/or `FAILED` to next state IDs. Exit code 0 = PASSED, non-zero = FAILED |
| `transitions` | map | ❌ | Named routing: maps arbitrary outcome keys to next state IDs. Last line of stdout must match a key exactly |
| `approval` | object | ❌ | Prompts the user for manual approval before routing. See [Approval block](#approval-block) |
| `max_visits` | number | ❌ | Maximum number of times this state may be entered in a single run. Throws immediately on the (N+1)th entry, before any side effects run. Applies to all state types |

> `on` and `transitions` are mutually exclusive. A state with neither is **terminal** — execution stops there.

> **Agents and `on:`** — Copilot agents always exit with code 0 regardless of what they do internally. This means `on: PASSED/FAILED` routing based on exit code does **not** work reliably for `type: agent`. Use `transitions:` instead and have the agent print the outcome key as its last line of output.

---

### Type: `agent`

Runs a Copilot agent defined in `.github/agents/`. In case your agent is designed to run in a loop, consider adding `max_visits` to prevent infinite loops and using `store_output` to maintain memory between runs.

| Field | Type | Required | Description |
|---|---|---|---|
| `agent` | string | ✅ | Agent ID as registered in `agent-registry.json` |
| `model` | string | ❌ | Override the model for this invocation (e.g. `gpt-4o`, `claude-sonnet-4.6`) |
| `prompt` | string | ❌ | Prompt sent to the agent. Defaults to `"Work according to your rules"`. You can reference vars here: `"Analyze ticket $RAILI_VAR_TICKET_ID"` |
| `store_output` | boolean | ❌ | If `true`, appends agent output to `.raili/outputs/<stateId>.md` after each run. On the next run, only the **most recent** run is injected into the agent's prompt (full history is kept on disk for auditing) |

> If you need routing, use `transitions:`, see above.

---

### Type: `script`

Runs a named script defined in `script-registry.json`.

| Field | Type | Required | Description |
|---|---|---|---|
| `script` | string | ✅ | Script ID as registered in `script-registry.json` |

---

### Type: `command`

Runs an inline shell command directly.

| Field | Type | Required | Description |
|---|---|---|---|
| `command` | string | ✅ | Shell command to execute (passed to `sh -c`) |
| `directory` | string | ❌ | Working directory for the command. Defaults to the project root |

---

### Type: `engine`

No-op state — performs no side effects. Useful as a branch point, start state, or terminal state.

---

### Notifications

| Field | Type | Description |
|---|---|---|
| `notify` | string | Shell command run when this state is **entered**, before anything else (including the handler). Works for all state types, including terminal states |
| `reset_outputs` | string[] | List of state IDs whose saved output files (`.raili/outputs/<id>.md`) are deleted when this state is entered. Useful for clearing agent memory at the start of a new cycle. Works for all state types |

---

## Approval block

Added under a state's `approval:` key. Prompts the user in the terminal after the state's handler has run.

| Field | Type | Required | Description |
|---|---|---|---|
| `question` | string | ✅ | The question shown to the user |
| `PASSED` | string | ✅ | Next state if the user presses Enter (approves) |
| `FAILED` | string | ✅ | Next state if the user types a reason (rejects) |
| `notify` | string | ❌ | Shell command run after the handler finishes but **before** the prompt is shown — ideal for sending a Slack/email notification that approval is needed |

---

## Routing rules

- **`on:`** — exit code decides outcome. Code 0 → `PASSED`, non-zero → `FAILED`. **Not suitable for `type: agent`** — Copilot agents always exit with code 0.
- **`transitions:`** — the **last line of stdout** must exactly match one of the keys. The agent/script/command is responsible for printing the correct key. **This is the correct routing mechanism for agents.**
- **`approval:`** — overrides `on:`/`transitions:` routing. The user's response decides the next state.
- **Terminal state** — no `on`, `transitions`, or `approval`. Workflow stops here.

---

## Inputs

`inputs` declares the user-supplied variables your workflow needs. Raili asks for them interactively at the start of a clean run, stores them in `context.json`, and sets them as `RAILI_VAR_*` environment variables for the entire process lifetime.

```yaml
inputs:
  - ticket_id
  - description
  - branch
```

**Supplying values:**

- **`vars.yaml`** — create `.raili/vars.yaml` (gitignored) to pre-fill values without typing them every run:
  ```yaml
  # .raili/vars.yaml
  ticket_id: PROJ-123
  description: Fix login bug
  ```
- **Interactive** (default) — on a clean run, Raili prompts for each declared input not supplied via a flag or vars.yaml:
  ```
  ticket_id: PROJ-123
  description: Fix login bug
  ```
- **Flags** — skip the prompt by passing values directly:
  ```
  raili run --clean --var ticket_id=PROJ-123 --var description="Fix login bug"
  ```
- **Continue run** — inputs are already in `context.json`, no prompting occurs.

**Precedence (highest to lowest):** `--var` flags → `vars.yaml` → interactive prompt

> Only keys declared in `inputs:` are read from `vars.yaml`. Any extra keys in the file are silently ignored — workflow.yaml remains the single source of truth for what a workflow needs.

**Env var naming:**

| Declared input | Env var |
|---|---|
| `ticket_id` | `RAILI_VAR_TICKET_ID` |
| `description` | `RAILI_VAR_DESCRIPTION` |
| `branch` | `RAILI_VAR_BRANCH` |

**Using inputs in your workflow:**

Because they are plain env vars, they work everywhere a shell is involved:

```yaml
# In a command
notify_ticket:
  type: command
  command: echo "Working on $RAILI_VAR_TICKET_ID"

# In a notify handler
analyze:
  type: agent
  agent: analyzer
  notify: "viesti.sh 'Starting $RAILI_VAR_TICKET_ID'"

# In an agent prompt — the explicit way to give an agent context
analyze:
  type: agent
  agent: analyzer
  prompt: "Analyze ticket $RAILI_VAR_TICKET_ID: $RAILI_VAR_DESCRIPTION"
```

Agents do **not** receive inputs automatically — you choose what to pass via the `prompt:` field. This keeps agent behaviour explicit and visible in the workflow.

> `inputs` is entirely optional. If you don't declare any, Raili never prompts and no env vars are set.

---

## Kill switch (`max_visits`)

`max_visits` prevents infinite loops by hard-stopping execution when a state is entered more than N times in a single run.

```yaml
code:
  type: agent
  agent: coder
  max_visits: 5          # engine throws on the 6th entry
  store_output: true
  on:
    PASSED: test
    FAILED: code
```

**Behaviour:**
- The count is per-run and per-state — it resets every time you start `raili run`
- The engine throws **before** any side effects (notify, reset_outputs, handler) on the exceeding visit
- Because Raili saves state to `context.json` on every transition, re-running after a `max_visits` error will resume from the state that exceeded the limit — giving you a clean retry without losing earlier progress

---

## Agent output memory

When `store_output: true` is set on an agent state, Raili maintains a history file at `.raili/outputs/<stateId>.md`. The full history is **always appended** to that file (each run separated by a `--- Run <timestamp> ---` header), so you have a complete audit trail on disk.

However, only the **last run** is injected into the agent's prompt on the next invocation — not the full history. This keeps the prompt size bounded regardless of how many iterations have accumulated, avoiding context window exhaustion.

To reset the memory at the start of a new work cycle, use `reset_outputs` on the state that begins the cycle:

```yaml
analyze:
  type: agent
  reset_outputs:
    - code       # clear code's memory when a new analysis cycle starts
```

---

## Full example

```yaml
initial: init

inputs:
  - ticket_id
  - description

states:

  # Entry point — clears agent memory for a new cycle
  init:
    type: engine
    reset_outputs:
      - code
    on:
      PASSED: analyze

  # Agent analyzes the ticket and decides the next step via last stdout line
  analyze:
    type: agent
    agent: analyzer
    model: gpt-4o
    prompt: "Analyze ticket $RAILI_VAR_TICKET_ID: $RAILI_VAR_DESCRIPTION"
    store_output: true
    notify: "msg.sh 'Starting analysis...'"
    transitions:
      ready_to_code: code
      nothing_to_do: done

  # Agent writes code, remembers previous attempts via stored output
  code:
    type: agent
    agent: coder
    store_output: true
    max_visits: 5
    on:
      PASSED: test
      FAILED: done

  # Inline command — routes via exit code
  test:
    type: command
    command: npm test
    directory: ./app
    on:
      PASSED: review
      FAILED: code

  # Script with human approval before proceeding
  review:
    type: script
    script: lint
    approval:
      notify: "viesti.sh 'Review needed'"
      question: "Does the code look good?"
      PASSED: deploy
      FAILED: code

  done:
    notify: "viesti.sh 'Workflow complete'"
    type: engine

include:
  - deploy.yaml
```

`deploy.yaml` (sub-workflow, lives in `.raili/deploy.yaml`):

```yaml
states:

  # Build a production artifact
  deploy:
    type: command
    command: npm run build && npm run deploy
    directory: ./app
    notify: "msg.sh 'Deploying...'"
    on:
      PASSED: smoke_test
      FAILED: done

  # Run a quick smoke test after deploy
  smoke_test:
    type: command
    command: ./scripts/smoke-test.sh
    on:
      PASSED: notify_success
      FAILED: rollback

  # Notify on success and finish
  notify_success:
    type: engine
    notify: "msg.sh 'Deploy succeeded'"
    on:
      PASSED: done

  # Roll back and go back to coding
  rollback:
    type: command
    command: npm run rollback
    notify: "msg.sh 'Deploy failed, rolling back'"
    on:
      PASSED: code
      FAILED: done
```

---

## Notes

- State IDs can be any string without spaces.
- `notify` commands are **best-effort** — a failure is logged as a warning but does not abort the workflow.
- `reset_outputs` only clears files under `.raili/outputs/`. It has no effect if no output has been stored yet.
- Sub-workflow files (`include`) must not define `initial` and must not reuse state IDs from the main workflow.
