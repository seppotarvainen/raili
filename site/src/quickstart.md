---
layout: layout.njk
title: Quickstart
permalink: /quickstart/
---

# Quickstart

## 1. Install

```bash
npm install -g @seppotarvainen/raili
```

## 2. Initialize a project

```bash
cd your-project
raili init
```

This creates a `.raili/` directory with template files:

- `agent-registry.json` — maps agent IDs to instruction files
- `script-registry.json` — maps script IDs to executable paths
- `main/workflow.yaml` — your first workflow definition

## 3. Define a workflow

### Minimal example

Edit `.raili/main/workflow.yaml`:

```yaml
inputs:
  - name: person
    description: "Name of the person to greet"

initial: hello

states:
  hello:
    type: command
    command: echo "Hello $RAILI_VAR_PERSON"
```

**What it does?**

1. Prompts you for the "person" input.
2. Runs the `echo` command with the provided input, greeting the person.
3. Workflow ends after executing the command.

### Realistic example

Edit `.raili/main/workflow.yaml`:

```yaml
inputs:
  - name: ticket_id
    description: Ticket ID to implement, e.g. PROJ-123
  - name: intent
    description: High-level intent for the ticket, e.g. "Implement user login flow"
    
initial: analyze

states:
  analyze:
    type: agent
    agent: analyzer
    prompt: |
      Analyze the following ticket
      
      Ticket: ${ticket_id}
      Description: ${intent}
      
      Make the plan according to your rules.
    continue: implement

  implement:
    type: agent
    agent: coder
    max_visits: 
      count: 3  
    output:
      store: true
      use_latest: 2
    prompt: |
      Implementation plan: ./plans/${ticket_id}.md
      Latest test run (if any): .raili/${workflow}/outputs/test.latest.md
      Latest implementation failure (if any): ${implement_FAILED}
      
      Work according to your rules.
    approval:
      question: "Is the implementation correct and complete?"
      PASSED: done
      FAILED: implement
      
  test:
    type: command
    command: name test
    output:
      store: true
      marker: Summary of all failing tests
      tail: 150
    on:  
      PASSED: publish
      FAILED: implement
      
  publish:
    type: command
    command: git add -A && git commit -m "Implement ${ticket_id}" && git push
    on:
      PASSED: done
      FAILED: exit

  done:
    notify: say "Ticket ${ticket_id} implemented successfully!"
    type: engine
    successful: true

  exit:
    notify: say "Failed to implement ticket ${ticket_id}."
    type: engine
    successful: false
```

**What it does?**

1. Prompts you for "ticket_id" and "intent" inputs.
2. Runs the "analyze" agent to create an implementation plan based on the ticket.
3. Continues to the "implement" agent, which creates the implementation according to the plan.
   1. `max_visits` limits the number of times the workflow can route back to this state, preventing infinite loops.
   2. `output.use_latest` injects the latest output from this state into the prompt. This way the agent know what it did the last time and can iteratively improve.
4. After implementation, it asks for approval. If approved, it moves to testing; if not, it goes back to implementation for another iteration.
5. The "test" state runs the tests and stores the output. If tests pass, it moves to publish; if they fail, it goes back to implementation.
6. The "publish" state attempts to commit and push the code. If it succeeds, the workflow ends successfully; if it fails, it ends with failure.
7. The "done" and "exit" states are terminal states that can be used to trigger notifications or other side effects via the `notify` hook.

## 4. Register your agents

Edit `.raili/agent-registry.json`:

```json
{
  "analyzer": { "path": ".github/agents/analyzer.md" },
  "coder": { "path": ".github/agents/coder.md" }
}
```

Then create the instruction files:
- `.github/agents/analyzer.md` — instructions for the analyzer agent
- `.github/agents/coder.md` — instructions for the coder agent

> **Tip:** In your agent's frontmatter, restrict the access to tools that may run wildly (e.g. shell). Agents are always run in 
> yolo-mode so it's best practice to restrict shell access from agents.

Example: `.github/agents/analyzer.md`:

```
---
name: analyzer
model: clude-sonnet-4.6
tools: ['read', 'view', 'search', 'edit', 'grep', 'glob']
---

You are a node in a deterministic state machine.

Create the implementation plan of the feature given to you.

Gather info, make the plan and save it to `./plans/<ticket_id>.md`
```

Example: `.github/agents/coder.md`:

```
---
name: coder
model: claude-haiku-4.5
tools: ['read', 'view', 'search', 'edit', 'grep', 'glob]
---

You are a node in a deterministic state machine.

Create the implementation according to the plan given to you in: `./plans/<ticket_id>.md`

If there's failing tests, they're in `.raili/<workflow>/outputs/test.latest.md`. 
Address these first before continuing with the rest of the implementation.
```

## 5. Run

```bash
raili run
```

Raili, prompts you with "ticket_id" input, validates everything upfront (registries, file paths, transitions) and then executes the state machine step by step.

## Next steps

- [State types](/docs/states/) — agent, script, command, engine, group
- [Routing](/docs/routing/) — binary, named transitions, approval
- [Variables](/docs/variables/) — interpolation, env exports, vars.yaml
- [Examples](/examples/) — real-world workflow patterns

