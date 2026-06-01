---
layout: layout.njk
title: Home
permalink: /
---

```
░█████████             ░██ ░██ ░██
░██     ░██                ░██    
░██     ░██  ░██████   ░██ ░██ ░██
░█████████        ░██  ░██ ░██ ░██
░██   ░██    ░███████  ░██ ░██ ░██
░██    ░██  ░██   ░██  ░██ ░██ ░██
░██     ░██  ░█████░██ ░██ ░██ ░██ 

Keeping agents on the rails since 2026.
```

# Raili

Raili is a deterministic CLI workflow orchestrator for AI-assisted development.
Instead of trusting agents to autonomously decide what to do, Raili gives you full control
over the workflow by letting you define exactly which steps to run, in which order, and with what inputs.

## Highlights

- **Define workflows as code** — YAML state machines with explicit transitions
- **Run agents inside workflows** — Full control over prompts and model selection
- **Mix agents + scripts** — Combine AI decisions with deterministic shell commands
- **Resumable execution** — Pause for approval, continue from where you left off
- **No surprises** — Fail-fast validation, explicit error handling, complete audit trail

## Get Started

```bash
npm install -g @seppotarvainen/raili
raili init
raili run
```

To get started for real, see [Quickstart guide](/quickstart/).

