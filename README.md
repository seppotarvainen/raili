# Raili

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js 18+](https://img.shields.io/badge/Node%20JS-18+-green)](https://nodejs.org)

Raili is a deterministic CLI workflow orchestrator for AI-assisted development with pluggable agent and script execution. Instead of trusting agents to autonomously decide what to do, Raili gives you full control over the workflow by letting you define exactly which steps to run, in which order, and with what inputs. This makes it ideal for development tasks where precision and predictability are important.

## Quick Take

- **Define workflows as code** — YAML state machines with explicit transitions
- **Run agents inside workflows** — Full control over prompts and model selection
- **Mix agents + scripts** — Combine AI decisions with deterministic shell commands
- **Resumable execution** — Pause for approval, continue from where you left off
- **No surprises** — Fail-fast validation, explicit error handling, complete audit trail

*GOOD FOR:* You or your team have established your own best practices for using agents in development and want a simple way to codify and share those practices in a reusable workflow.

*NOT GOOD FOR:* Ad-hoc experimentation or exploration where you want the agent to have more freedom to decide what to do.

# Philosophy

- Humans do what humans do best: defining the overall workflow, deciding which steps to include and in which order, and providing high-level guidance to the agents.
- Agents do what agents do best: generating content, making decisions based on information, and performing tasks that require understanding and creativity.
- Scripts and commands do what they do best: executing deterministic actions in the environment, such as running tests, building code, or performing file operations.

# Installation

Works on macOS and Linux. Windows support is not yet tested.

## Prerequisites

- **Node.js** 18+ (tested with 22.12.0)
- **npm**
- **GitHub Copilot CLI** — Install with `gh extension install github/gh-copilot` (requires [`gh`](https://cli.github.com) CLI)

## Install globally

```bash
npm install -g raili
```

# How it works

## Setup

Run `raili init`.

## Define agents

Create agents where copilot sees them. Either globally or by repo. Add them to `.raili/agent-registry.json` as follows:

```json
{
  "coding": {
    "path": "~/my/project/.github/agents/raili-coding.agent.md",
    "model": "gpt-5-mini"
  }
}
```

> RECOMMENDATION: Agents are run in yolo-mode. Don't give your agents access to shell, rather create scripts or commands in your workflow.

## Define scripts

Scripts are executable files in your repo that perform a specific task. They can be written in any language and can be invoked from your workflow. Add them to `.raili/script-registry.json`:

```json
{
  "run_tests": {
    "path": "scripts/test.sh"
  }
}
```

## Create a workflow

Use a simple YAML syntax to define a workflow that consists of a series of states. Each state can be an agent action, a shell command, or a script execution. Example:

```yaml
inputs:
  - name: title
    description: "Brief title for the ticket"
  - name: intent
    description: "High-level intent for the ticket"
    
initial: plan  

states:
  plan:
    type: agent
    agent: planning.agent
    prompt: |
      Make the implementation plan for the following ticket:
      Title: ${title}
      Intent: ${intent}
    output:
      store: true
    approval:
      question: "Is the plan good to go?"
      PASSED: code
      FAILED: exit
      
  code:
    type: agent
    agent: coding.agent
    prompt: |
      Write the code for the following implementation plan found in:
      .raili/main/outputs/plan.md
      
      If there are failing tests, they're here:
      .raili/main/outputs/test.md
    on:
      PASSED: test
      FAILED: test
   
  test:
    type: command
    command: npm test
    output:
      store: true
    on:
      PASSED: done
      FAILED: code

  done:
    type: engine
    notify: "echo 'Workflow completed successfully!'"
    success: true

  exit:
    type: engine
    notify: "echo 'Workflow failed!'"
    success: false
```

## Run your workflow

Run `raili run` and follow the prompts.

## More help

Run `raili docs` for detailed documentation on workflow syntax, routing, variables, and more.

Run `raili schema` for workflow schema reference.

# Local development

Install dev dependencies:

```bash
npm install
```

Build:

```bash
npm run build
```

Run tests:

```bash
npm test
```

Install globally during development:

```bash
npm run build
npm install -g .
```

# License

MIT © Seppo Tarvainen

# Contributing

This project is source-available. I'm not accepting pull requests, but I do welcome **bug reports and feature requests**. See [CONTRIBUTING.md](./CONTRIBUTING.md) for details.
