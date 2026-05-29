---
layout: layout.njk
title: Examples
permalink: /examples/
---

# Examples

## Code Review Pipeline

An agent analyzes code, a script runs tests, and a human approves before merge.

```yaml
initial: analyze
inputs: [branch]

states:
  analyze:
    type: agent
    agent: reviewer
    prompt: "Review changes on branch ${branch}"
    transitions:
      approve: "test"
      reject: "done"

  test:
    type: script
    script: run_tests
    on:
      PASSED: "approve"
      FAILED: "analyze"

  approve:
    type: engine
    approval:
      question: "Tests pass. Merge ${branch}?"
      PASSED: "merge"
      FAILED: "analyze"

  merge:
    type: command
    command: "git merge ${branch}"
    on:
      PASSED: "done"
      FAILED: "done"

  done:
    type: engine
```

## Multi-Agent Ticket Flow

Break down a ticket, implement it, then verify with tests.

```yaml
initial: breakdown
inputs: [ticket_id]

states:
  breakdown:
    type: agent
    agent: planner
    prompt: "Break down ticket ${ticket_id} into implementation steps"
    transitions:
      ready: "implement"
      needs_info: "done"

  implement:
    type: agent
    agent: coder
    prompt: "Implement the plan from the breakdown phase"
    on:
      PASSED: "verify"
      FAILED: "breakdown"

  verify:
    type: script
    script: run_tests
    on:
      PASSED: "done"
      FAILED: "implement"

  done:
    type: engine
    success: true
```

## Script-Only CI Pipeline

No agents — pure deterministic shell script orchestration.

```yaml
initial: lint
inputs: []

states:
  lint:
    type: command
    command: "npm run lint"
    on:
      PASSED: "test"
      FAILED: "notify_failure"

  test:
    type: command
    command: "npm test"
    on:
      PASSED: "build"
      FAILED: "notify_failure"

  build:
    type: command
    command: "npm run build"
    on:
      PASSED: "done"
      FAILED: "notify_failure"

  notify_failure:
    type: engine
    notify: "echo 'Pipeline failed'"

  done:
    type: engine
    success: true
```

