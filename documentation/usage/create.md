# create

> Create a new named workflow scaffold under `.raili/<workflow>`.

## Usage

```
raili create -w <workflow>  # Creates a new workflow scaffold under .raili/<workflow>
```

## Description

Creates a new workflow directory under `./.raili/<workflow>` containing a scaffolded `workflow.yaml`, `vars.yaml`, and the directories `outputs/` and `learnings/`.

The command is intentionally fail-fast:

- **Requires** a pre-existing `.raili/` directory (run `raili init` first).
- Fails if the workflow name is empty or contains `/` or `\`.
- Fails if `.raili/<workflow>` already exists.

Files created

- `.raili/<workflow>/workflow.yaml` — starter workflow definition
- `.raili/<workflow>/vars.yaml` — placeholder variables file
- `.raili/<workflow>/outputs/` — output storage directory
- `.raili/<workflow>/learnings/` — agent learnings directory

Example generated `workflow.yaml`

```yaml
initial: init
inputs: []

states:
  init:
    type: engine

  archive:
    type: script
    script: archive-part
    transitions:
      more_parts: analyze
      no_more_parts: done

  analyze:
    type: agent

  done:
    type: engine
```

## Errors and messages

- `.raili/ directory not found. Run `raili init` first` — returned when `.raili/` is missing.
- `Invalid workflow name` — returned for empty names or names containing path separators.
- `.raili/<workflow> already exists` — returned if target directory exists.

## See also

- `documentation/usage/init.md` — initializing a project and `.raili/`
- `documentation/usage/run.md` — running workflows once created
