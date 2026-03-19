# init

> Initialize a new Raili project with `.raili/` directory and template configuration files.

## Usage

```bash
raili init
```

## What It Creates

The `raili init` command creates a `.raili/` directory with a default `main` workflow scaffold:

```
.raili/
├── agent-registry.json       # Agent mappings (shared across all workflows)
├── script-registry.json      # Script mappings (shared across all workflows)
└── main/                     # Default workflow directory
    ├── workflow.yaml          # Workflow state machine definition
    ├── vars.yaml              # Input variable defaults (optional)
    ├── outputs/               # Agent/script outputs (auto-populated on run)
    └── learnings/             # Agent learnings (auto-populated on run)
```

### `main/workflow.yaml`
The main workflow configuration file. Defines:
- Initial state
- All states and their types
- State transitions and routing
- Variables (inputs)

Edit this file to describe your workflow.

### `agent-registry.json`
Maps agent names to their files and optional model overrides. Shared across all workflows.

Example:
```json
{
  "analyzer": {
    "path": ".github/agents/analyzer.md",
    "model": "gpt-4o"
  },
  "coder": {
    "path": ".github/agents/coder.md"
  }
}
```

### `script-registry.json`
Maps script names to their files. Shared across all workflows.

Example:
```json
{
  "run_tests": {
    "path": "./scripts/test.sh"
  },
  "deploy": {
    "path": "./scripts/deploy.sh"
  }
}
```

## Adding More Workflows

To create an additional named workflow, add a new subdirectory under `.raili/`:

```bash
mkdir -p .raili/dev/outputs .raili/dev/learnings
# create .raili/dev/workflow.yaml
```

Run it with:
```bash
raili run --workflow dev
```

Each workflow directory is independent — its `context.json`, `outputs/`, and `learnings/` never mix with other workflows. Registries are always shared from `.raili/`.

## Next Steps

1. **Edit `.raili/main/workflow.yaml`** — Define your workflow states and transitions
2. **Register agents** — Add entries to `agent-registry.json` pointing to your agent files
3. **Register scripts** — Add entries to `script-registry.json` pointing to your shell scripts
4. **Run your workflow** — Use `raili run` to execute

## Error Handling

If `.raili/` already exists, `raili init` will not overwrite existing files and exits with an error.

## Configuration Files

- `.raili/agent-registry.json` — Agent mappings (required, shared)
- `.raili/script-registry.json` — Script mappings (required, shared)
- `.raili/main/workflow.yaml` — Default workflow definition (required)
- `.raili/main/vars.yaml` — Input variable defaults (optional)
- `.raili/main/context.json` — Runtime state (auto-created on first run)
- `.raili/main/outputs/` — Stored agent/script outputs (auto-created)
- `.raili/main/learnings/` — Agent learnings (auto-created)
