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

### 1. Fixed State Machine Skeleton - DONE

Raili uses a predefined workflow structure (e.g.,
`init → analyze → plan → execute → verify → archive → done`).\
States are not dynamically created in MVP.

### 2. Configurable State Behavior - DONE

Each state's behavior (agent, script, manual interaction) is defined in
`workflow.yaml`.

### 3. Agent Execution Support - DONE

States may invoke agents defined in the agent registry.\
Agent configuration includes agent file path and model defined in
frontmatter.

### 4. Script Execution Support - TODO

States may execute predefined scripts defined in the script registry.\
Scripts are referenced by name and resolved via registry mapping.

### 5. Manual Transition Support - TODO

States can define manual transitions requiring user confirmation via CLI
prompt.

### 6. Transition Handling - TODO

Transitions support: - `PASSED` - `FAILED` - Manual approval states -
Loopbacks (e.g., `verify → execute`)

### 7. Registry Validation - TODO

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
    transition:
      manual:
        question: "Is the plan correct?"
        PASSED: execute
        FAILED: analyze

  archive:
    type: script
    script: archive-part
```

------------------------------------------------------------------------

## Future Enhancements (Not MVP)

- Dynamic state graph definition
- Plugin system
- Retry/backoff policies
- Workflow persistence and resume support
- Parallel execution
- Event logging and audit trail
- Telemetry integration
