# init

> Initialize a new Raili project with `.raili/` directory and template configuration files.

## Usage

```bash
raili init
```

## What It Creates

The `raili init` command creates a `.raili/` directory in your project with three template files:

### `workflow.yaml`
The main workflow configuration file. Defines:
- Initial state
- All states and their types
- State transitions and routing
- Variables (inputs)

Edit this file to describe your workflow.

### `agent-registry.json`
Maps agent names to their files and optional model overrides.

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
Maps script names to their files.

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

## Next Steps

1. **Edit `.raili/workflow.yaml`** — Define your workflow states and transitions
2. **Register agents** — Add entries to `agent-registry.json` pointing to your agent files
3. **Register scripts** — Add entries to `script-registry.json` pointing to your shell scripts
4. **Run your workflow** — Use `raili run` to execute

## Error Handling

If `.raili/` already exists, `raili init` will not overwrite existing files. Create a new directory or manually delete `.raili/` if you want to reinitialize.

## Configuration Files

- `.raili/workflow.yaml` — Your workflow definition (required)
- `.raili/agent-registry.json` — Agent mappings (required)
- `.raili/script-registry.json` — Script mappings (required)
- `.raili/context.json` — Runtime state (auto-created on first run)
- `.raili/outputs/` — Stored agent/script outputs (auto-created)
- `.raili/vars.yaml` — Input variables (optional, create manually)

