# Variables

> Declare inputs with `inputs:`, supply values via flags/vars.yaml/prompt, use with `${name}` in YAML or
> `$RAILI_VAR_NAME` in shell.

## Declaring Inputs

Declare the variables your workflow needs:

```yaml
inputs:
  - ticket_id
  - branch
  - description
```

## Supplying Values

Precedence (highest to lowest): flags → vars.yaml → interactive prompt

### CLI Flags

```bash
raili run --clean --var ticket_id=PROJ-123 --var branch=main
```

### vars.yaml File

Create `.raili/vars.yaml` (gitignored) to avoid typing every run:

```yaml
ticket_id: PROJ-123
branch: main
description: "Fix login bug"
```

Only keys declared in `inputs:` are read from this file.

### Interactive Prompt

On a clean run with missing inputs:

```
ticket_id: PROJ-123
branch: main
description: Fix login bug
```

## Using Variables in YAML

Use `${variable_name}` (lowercase, no prefix) in agent prompts and approval questions:

```yaml
analyze:
  type: agent
  prompt: "Analyze ticket ${ticket_id} on ${branch}: ${description}"

review:
  type: engine
  approval:
    question: |
      Update ticket ${ticket_id}?
      Branch: ${branch}
      Approve?
    PASSED: deploy
    FAILED: edit
```

## Using Variables in Shell

Variables are exported as `$RAILI_VAR_<UPPERCASE>` for shell contexts (commands, notify handlers):

```yaml
notify_start:
  type: command
  notify: "msg.sh 'Starting work on $RAILI_VAR_TICKET_ID'"

deploy:
  type: command
  command: "deploy.sh $RAILI_VAR_TICKET_ID --branch $RAILI_VAR_BRANCH"
```

Scripts invoked via `script` states may also accept positional `args:` declared in the workflow. These args are forwarded to the script as-is; use `$RAILI_VAR_<UPPERCASE>` inside the script invocation if you want to include declared variables.

```yaml
run_tests_with_ticket:
  type: script
  script: run_tests
  args:
    - "$RAILI_VAR_TICKET_ID"
    - "--report"
  on:
    PASSED: success
    FAILED: rework
```

## Environment Variable Mapping

| Declared input | Env var                  | YAML reference   |
|----------------|--------------------------|------------------|
| `ticket_id`    | `$RAILI_VAR_TICKET_ID`   | `${ticket_id}`   |
| `branch`       | `$RAILI_VAR_BRANCH`      | `${branch}`      |
| `description`  | `$RAILI_VAR_DESCRIPTION` | `${description}` |

## Important Notes

- Only keys in `inputs:` are prompted/available — workflow.yaml is the source of truth
- Missing variables → immediate error (fail-fast)
- Use `$$` to escape literal `$`: `$$100` becomes `$100`
- Variables persist in `context.json` across runs
- On `raili run --continue`, inputs are NOT re-prompted (use existing context)

