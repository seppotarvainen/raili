# Raili Orchestrator -- MVP Feature Specification

## Overview

Raili is a CLI-based workflow orchestrator built with Node.js and
TypeScript.\
It executes a fixed state-machine workflow with configurable state
behavior using agent and script registries stored in a `.raili/`
directory.

------------------------------------------------------------------------

## CLI Commands

### 1. `raili init`

Initializes a new Raili configuration in the current project directory.

- Creates an empty `.raili/` folder.
- Generates template files:
  - `workflow.yaml`
  - `agent-registry.json`
  - `script-registry.json`
- If `.raili/` already exists, the command should not overwrite
  existing files. Inform user that action is forbidden.

------------------------------------------------------------------------

### 2. `raili run`

Executes the orchestrator workflow.

- Validates that `.raili/` directory exists. If not, instruct the user
  to run `raili init` first.
- Validates that `agent-registry.json` and `script-registry.json`
  exist and are valid JSON.
- Fails fast with clear error messages if registries are missing or
  malformed.
- Executes the predefined state machine in order.
- Supports manual and automatic transitions.
- Stops execution on failure unless retry is explicitly triggered.

------------------------------------------------------------------------

### 3. `raili help`

Shows usage information and brief descriptions of available commands.

- Usage examples:
  - `raili help` — prints a short summary of commands and their purpose.
  - `raili --help` — equivalent to `raili help`.
  - `raili <command> --help` — prints help for a specific command (for example `raili init --help`).

- Purpose:
  - Provide discoverability for the CLI in interactive use.
  - Print short guidance and examples for common workflows.

- Example minimal help output:

```
Usage: raili <command>

Commands:
  init   Initialize a .raili/ directory with template files
  run    Validate and execute the configured workflow
  help   Show this help message
```

This command should be implemented as a simple, deterministic formatter that reads no runtime state and does not modify files. It is intended purely for user guidance.

------------------------------------------------------------------------

## Core MVP Requirements

### 0. Initial Setup and Validation - DONE

- `raili init` must create `.raili/` with template files.
- `raili run` must validate existence and correctness of `.raili/` and
  registries before execution.

### 1. Workflow-Driven State Machine - DONE

Raili's state machine is fully defined by `workflow.yaml` — it is the
single source of truth for states and transitions.\
The engine builds the state machine from the workflow config at startup.\
States are not dynamically created in MVP.

### 2. Configurable State Behavior - DONE

Each state's behavior (agent, script, manual interaction) is defined in
`workflow.yaml`.

### 3. Agent Execution Support - DONE

States may invoke agents defined in the agent registry.\
Agent configuration includes agent file path and model defined in
frontmatter.

### 4. Script Execution Support - DONE

States may execute predefined scripts defined in the script registry.\
Scripts are referenced by name and resolved via registry mapping.

### 5. Manual Transition Support - DONE

States can define manual transitions requiring user confirmation via CLI
prompt. If a state in `workflow.yaml` has an `approval` block, the engine
automatically pauses after that state completes and prompts the user before
transitioning. No separate `manual-approve` state is needed in the workflow.

Example:

```yaml
plan:
  type: agent
  agent: planner.agent
  approval:
    question: "Is the plan correct?"
    PASSED: execute
    FAILED: plan
```

### 6. Transition Handling - DONE

Transitions support: - `PASSED` - `FAILED` - Manual approval states -
Loopbacks (e.g., `verify → execute`)

### 7. Registry Validation - DONE

Before execution, `raili run` must validate: - `.raili/` exists - Agent
registry exists and is valid - Script registry exists and is valid

Execution must fail clearly if validation fails.

### 8. Extensibility via Registries - TODO

Agent and script registries can be modified manually by users.\
No dynamic plugin system is required in MVP.

### 9. Local Execution Only - TODO

All execution is local. No distributed workers or remote services
required.

### 10. npm Package Distribution - TODO

Raili is distributed as a private npm package via client's private
registry.\
Installation example:

```bash
npm install @client/raili
```

------------------------------------------------------------------------

### 11. Help and Discoverability - TODO

The CLI must provide a deterministic, read-only help facility that
helps users discover available commands and usage.

- `raili help` and `raili --help` MUST print a short summary of
  commands and purpose.
- `raili <command> --help` MUST print command-specific usage and
  examples (for example `raili init --help`).
- Help output MUST be read-only and deterministic: it should not read
  runtime state or modify files.
- Help should include concise examples for common tasks (init, run,
  troubleshooting validation errors).

This requirement complements the `raili help` CLI command described
above; implement as a simple formatter, not a dynamic introspection
system.

------------------------------------------------------------------------

## Example `.raili/` Folder Structure

    .raili/
    ├── workflow.yaml
    ├── agent-registry.json
    └── script-registry.json

------------------------------------------------------------------------

## Example `agent-registry.json`

```json
{
  "analyzer.agent": {
    "path": "./agents/analyzer.agent.md"
  },
  "planner.agent": {
    "path": "./agents/planner.agent.md"
  }
}
```

------------------------------------------------------------------------

## Example `script-registry.json`

```json
{
  "archive-part": "./archive.sh",
  "hour-tracking": "./log-hours.sh",
  "notify-slack": "./notify.sh"
}
```

------------------------------------------------------------------------

## Example `workflow.yaml`

```yaml
states:
  analyze:
    type: agent
    agent: analyzer.agent
    prompt: "Ticket id: {{ticketId}}"

  plan:
    type: agent
    agent: planner.agent
    prompt: "Work according to your rules"
    approval:
      question: "Is the plan correct?"
      PASSED: execute
      FAILED: analyze

  archive:
    type: script
    script: archive-part
```

------------------------------------------------------------------------

## Architecture Decisions

### AD-1: Manual approval is inline, not a separate state - DECIDED (2026-02-24)

Manual approval is triggered automatically by the engine when a state has
an `approval` block in `workflow.yaml`. There is no explicit `manual-approve`
state in the workflow. This keeps workflows clean and the approval contract
co-located with the state it belongs to.

### AD-2: How does an agent or script signal its outcome to the engine? - DECIDED (2026-02-25)

Two mutually exclusive transition styles exist in `workflow.yaml`. A state must use one or the other, not both.

**`on:` — binary outcomes (PASSED / FAILED)**

Used when the handler either succeeded or failed. The engine uses the
process exit code: `0` → `PASSED`, non-zero → `FAILED`.

```yaml
execute:
  type: agent
  agent: executor.agent
  on:
    PASSED: test
    FAILED: execute
```

**`transitions:` — named outcomes**

Used when a handler needs to route to more than two states. The engine
reads the **last line of stdout** after execution and matches it against
the keys in `transitions:`. If the value does not match any key, the
engine throws immediately (fail-fast).

```yaml
verify:
  type: agent
  agent: verifier.agent
  transitions:
    tests_failed: execute
    commit_required: commit
    ready_for_archive: archive
```

The agent or script is responsible for printing exactly one outcome token
as its last stdout line (e.g. `echo "commit_required"`). This applies equally
to agent and script states. A state may not have both `on:` and `transitions:`.

------------------------------------------------------------------------

## Future Enhancements (Not MVP)

- Dynamic state graph definition
- Plugin system
- Retry/backoff policies
- Workflow persistence and resume support
- Parallel execution
- Event logging and audit trail
- Telemetry integration
