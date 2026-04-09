> Generate a visual diagram of a workflow (Mermaid/HTML).

## Overview

`raili visual` builds a directed graph of the selected workflow and emits a Mermaid diagram or an HTML-wrapped Mermaid document. It performs the same strict, fail-fast validation as `raili run` (requires `.raili/` and valid registries and workflow references).

## Usage

```bash
# Default: generate HTML into the workflow directory (.raili/<workflow>/diagram.html)
raili visual

# Named workflow, write Mermaid to stdout
raili visual -w dev -f mermaid -o -

# Write a .mmd file
raili visual -o /tmp/my-diagram.mmd

# Show help for visual
raili visual -h
```

## Flags

- `--workflow, -w` — workflow name (defaults to `main`).
- `--format, -f` — output format; currently `mermaid` (diagram syntax) is supported. Defaults to `mermaid`.
- `--out, -o` — output path. Special value `-` prints raw Mermaid to stdout. If omitted an HTML file is written to `.raili/<workflow>/diagram.html`. If path ends with `.mmd` a plain Mermaid file is written.
- `--help, -h` — show command help.

## Behavior & Validation

- Requires a `.raili/` directory in the project root. If missing the command errors with: `.raili/ directory not found. Run `raili init` first.`
- Validates `agent-registry.json` and `script-registry.json` and that workflow references exist — missing registries or unresolved references cause immediate failure (fail-fast).
- When `--out -` is used the command emits the raw Mermaid text to stdout (useful for piping).
- Default output is an HTML wrapper around the Mermaid syntax (saved as `diagram.html` in the selected workflow directory).

## Examples

Minimal generated HTML (default):

```bash
raili visual                 # writes .raili/main/diagram.html
```

Print Mermaid to stdout:

```bash
raili visual -w main -f mermaid -o - | pbcopy
```

Write a Mermaid file to disk:

```bash
raili visual -o ./docs/workflows/main.mmd
```

## Notes

- The visual command is read-only: it only loads and validates workflow/registry files and writes the generated diagram file.
- Mermaid labels now include a type emoji for each node (for example **agent** → 🤖, **script** → 📜, **command** → 📢). Labels use an HTML-style break (`<br/>`) so the emoji appears under the node title for readability.
- The renderer no longer emits the pseudo-state initial arrow (`[*] --> ...`). The initial node is shown without a pseudo-state transition to keep the flowchart valid.
- Annotations such as `output.store` and `max_visits` are emitted as Mermaid comments (``%% <node>: ...``) rather than `Note over` blocks to ensure generated flowcharts remain valid in Mermaid flowchart context.

(See `documentation/states.md`, `documentation/routing.md`, and `documentation/usage/run.md` for related workflow and validation behavior.)