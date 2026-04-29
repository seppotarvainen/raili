# Variables

> Declare inputs with `inputs:`, supply values via flags/vars.yaml/prompt, use with `${name}` in YAML or
> `$RAILI_VAR_NAME` in shell.

## Declaring Inputs

Declare the variables your workflow needs. Two forms are accepted:

Declaring Inputs

Inputs may be declared either as shorthand strings or as objects. The `description` field is optional. Examples:

```yaml
inputs:
  - name: ticket_id
    description: |
      The upstream issue tracker ID for this work.
      Example: PROJ-123
    log: true
  - name: branch
    description: "Git branch to use for the patch"
  - name: description
    description: "Short description of the change"
```

## Supplying Values

Precedence (highest to lowest): flags → vars.yaml → interactive prompt

### CLI Flags

```bash
raili run --clean --var ticket_id=PROJ-123 --var branch=main
```

### vars.yaml File

Two locations are supported (workflow-specific takes precedence):

- **`.raili/<workflow>/vars.yaml`** — vars for a specific workflow (e.g. `.raili/main/vars.yaml` or `.raili/dev/vars.yaml`)
- **`.raili/vars.yaml`** — shared fallback available to all workflows

Create the appropriate file (gitignored) to avoid typing every run:

```yaml
ticket_id: PROJ-123
branch: main
description: "Fix login bug"
```

Only keys declared in `inputs:` are read from these files. If the `inputs:` list is empty, Raili will instead load all keys present in `.raili/<workflow>/vars.yaml` (useful for legacy projects or simple workflows that do not declare inputs).

## Vars resolver (`--resolve-vars`)

Raili supports a workflow-local JavaScript resolver that can programmatically provide or augment input variables at run start. Place a module named `vars-resolver.js` inside the workflow directory (for example `.raili/main/vars-resolver.js`). When the `--resolve-vars` flag is provided on the CLI, Raili will attempt to load and execute that module and merge returned values into the run's inputs.

Key points:

- Resolver path: `.raili/<workflow>/vars-resolver.js` (must export a function).
- CLI flag: `--resolve-vars [key=val ...]` — optional positional tokens are forwarded to the resolver and parsed into named (`key=val`) and positional arguments.
- Merge precedence (highest → lowest): CLI flags → resolver result → `vars.yaml` file.
- If `--resolve-vars` is provided but the resolver file is missing, Raili fails fast with: `vars-resolver.js not found in workflow directory, but --resolve-vars was provided`.
- If the resolver returns `null`, Raili treats it as an empty result and continues (the `vars.yaml` and CLI flags remain in effect).
- The resolver must return an object mapping string keys to string values. Non-string values cause an error.

Example resolver (`.raili/main/vars-resolver.js`):

```js
module.exports = async function resolveVars(input) {
  // input.namedArgs = { card: '1' }, input.positionalArgs = ['a']
  return { ticket_id: 'PROJ-123', branch: 'fromResolver' };
};
```

CLI example:

```bash
# Call resolver with named args and positional tokens
raili run --clean --resolve-vars card=1
```

The resolver feature is opt-in; `raili init` now includes a `vars-resolver.js` template in the generated workflow scaffold.

### Interactive Prompt

On a clean run with missing inputs the CLI will prompt for any values not supplied via flags or `vars.yaml`:

```
ticket_id: PROJ-123
branch: main
description: Fix login bug
```

Note: `--dry-run` is non-interactive. When `--dry-run` is used the engine will not prompt for missing inputs — it will merge values from the workflow `vars.yaml` (if present) with CLI flags and perform validation only. Use `--dry-run` in CI to validate workflows without human interaction.

## Using Variables in YAML

Use `${variable_name}` (lowercase, no prefix) in agent prompts and approval questions.

Note: YAML interpolation is an exact, case-sensitive lookup against the workflow's `context.vars`. For prompts and approval questions the engine performs YAML-style interpolation where missing variables are replaced with an empty string (so `${missing}` → ``). This behavior is deliberate and does not change the default fail-fast behavior of interpolateString (which still throws unless called with `throwOnMissing: false` or an explicit `missingValue`).

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

### Exposing variables from scripts/commands

Script and command states can explicitly expose values produced during execution back into the workflow as variables. Declare `expose: [name1, name2]` on a `script` or `command` state; after the state completes the engine will extract `name=value` lines from stdout and set `RAILI_VAR_<UPPERCASE>` for subsequent states.

Accepted formats (case-insensitive key; whitespace and optional `export` prefix allowed):

- `name=value`
- `export name=value`
- `name = "value"`
- `name='value'`

The parser trims whitespace and surrounding quotes. If a state declares `expose`, the engine will fail-fast and throw a clear error when any listed variable is not produced (missing or empty). Important: using `export VAR=...` inside a child process does not propagate the value to the parent — the script must print the value to stdout in one of the accepted formats.

Example:

```bash
# Correct: prints id on stdout in expected format
echo "id=123"

# Also accepted:
echo "export id=123"
echo "ID = '123'"
```

Workflow example:

```yaml
produce_id:
  type: script
  script: gen_id
  expose: [id]
  on:
    PASSED: use_id

use_id:
  type: command
  command: "echo \"Using id $RAILI_VAR_ID\""
  on:
    PASSED: done
```

The engine validates that every declared `expose` name is produced (non-empty) and throws immediately if any are missing (fail-fast).

## Environment Variable Mapping

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

- Script `args:` interpolation: `args:` declared on `script` states support `${VARIABLE}` interpolation using the workflow's variables. Interpolation runs before the script is spawned and Raili will fail fast with a clear error when any referenced variable is not defined. To pass raw shell env vars, continue to use `$RAILI_VAR_<UPPERCASE>` in `args:` or `notify`/`command` values.
- A read-only `workflow` variable is injected into every run and set to the workflow directory name (for the default workflow this is `main`). Use `${workflow}` in agent prompts/approval questions and `$RAILI_VAR_WORKFLOW` in shell contexts. The `workflow` variable is set on clean runs and preserved when continuing an existing run (it is not read from `vars.yaml`).
- Missing variables → immediate error (fail-fast)
- Use `$$` to escape literal `$`: `$$100` becomes `$100`
- Variables persist in `context.json` across runs
- On `raili run --continue`, inputs are NOT re-prompted (use existing context)

## Approval reason env mapping

Non-empty approval reasons supplied by users when declining an approval or returned by an approval resolver are persisted into a dedicated `approvals` map in the workflow context and mirrored into `context.vars` using the key `<STATE>_<OUTCOME>` (uppercased). This allows notify commands and scripts to access the reason via the existing environment mapping as `RAILI_VAR_<KEY>` (e.g. `$RAILI_VAR_REVIEW_FAILED`). Only non-empty reasons are mirrored (empty strings are ignored).

Note: resolvers may return a reason alongside either `PASSED` or `FAILED` outcomes; when present the reason is persisted regardless of the outcome value.
