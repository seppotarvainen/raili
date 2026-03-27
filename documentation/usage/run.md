# run

> Validate and execute your workflow. Runs the state machine from the current or initial state until a terminal state is reached.

## Usage

```bash
raili run                              # Resume or start the main workflow
raili run --clean                      # Force a clean run (clears context, re-prompts for inputs)
raili run --continue                   # Resume from last state
raili run --dry-run                    # Validate workflow and registries without executing
raili run --var key=value              # Supply workflow inputs
raili run --workflow <name>            # Run a named workflow (e.g. .raili/dev/)
raili run --workflow <name> --clean    # Start a named workflow fresh
```

## Examples

### Basic run
```bash
raili run
# Prompts to continue existing run or start clean
```

### Clean run with inputs
```bash
raili run --clean --var ticket_id=PROJ-123 --var branch=main
```

### Named workflow
```bash
# Runs .raili/dev/workflow.yaml
raili run --workflow dev --clean --var ticket_id=PROJ-123
```

### Resume from last state
```bash
raili run --continue
# Reuses context.json from previous run
```

### Multiple input variables
```bash
raili run --clean \
  --var ticket_id=TICKET-456 \
  --var description="Fix login bug" \
  --var branch=develop
```

## Workflow Directories

`raili run` always operates on a workflow directory under `.raili/`. The `--workflow` flag selects which one:

| Command | Workflow directory |
|---|---|
| `raili run` | `.raili/main/` |
| `raili run --workflow dev` | `.raili/dev/` |
| `raili run --workflow test` | `.raili/test/` |

The selected directory must already exist and contain a `workflow.yaml`. Registries (`agent-registry.json`, `script-registry.json`) are always loaded from `.raili/` root and are shared.

Each workflow directory keeps its own isolated artifacts:
```
.raili/
├── agent-registry.json        # shared
├── script-registry.json       # shared
├── main/
│   ├── workflow.yaml
│   ├── vars.yaml
│   ├── context.json           # main run state
│   └── outputs/
└── dev/
    ├── workflow.yaml
    ├── vars.yaml
    ├── context.json           # dev run state (independent)
    └── outputs/
```

## Dry-run mode

The `--dry-run` flag performs the full startup validation without entering the runner execution loop. It verifies workflow YAML/schema, builds and validates the state machine, loads and validates shared registries (`agent-registry.json`, `script-registry.json`), resolves referenced agent/script files, and (for `--clean`) reads declared inputs from `.raili/<workflow>/vars.yaml` and merges CLI flags. Dry-run is non-interactive: it implicitly accepts any skip confirmations and will not prompt for missing inputs. No on-disk artifacts are modified — context, outputs, and the run-log are not written.

Example:

```bash
# Validate using vars.yaml and flags, but do not execute handlers
raili run --dry-run

# Validate a named workflow with an inline var
raili run --workflow main --dry-run --var ticket_id=123
```

## Execution Flow

1. **Load & Validate** → Reads `.raili/` directory, shared registries, and the selected workflow
2. **Initialize Context** → On clean run, creates fresh context with declared inputs; on continue, loads saved state
3. **Build State Machine** → Converts `workflow.yaml` into a runtime state DAG
4. **Run Loop** → Executes states in order:
   - Enter state (run notify hook if present)
   - Clear outputs (if `reset_outputs` specified)
   - Execute handler (agent, script, command, or engine)
   - Route based on outcome
   - Save context to `<workflow>/context.json`

Startup confirmation: If any states in the selected workflow have `skip` configured, Raili will display a confirmation listing those states and prompt the user: pressing Enter accepts the skips and proceeds; typing any non-empty input cancels the run. In tests or CI you can bypass the interactive prompt by setting the environment variable `RAILI_MANUAL_CHOICE=PASSED` (accept) or `RAILI_MANUAL_CHOICE=FAILED` (decline).

5. **Stop** → Terminal state reached or error occurred

## Input Variables

### Declare inputs in workflow.yaml
```yaml
inputs:
  - ticket_id
  - branch
  - description
```

### Supply values (precedence)

1. **CLI flags** (highest priority)
   ```bash
   raili run --var ticket_id=PROJ-123
   ```

2. **Vars file** (optional, git-ignored)
   - `.raili/<workflow>/vars.yaml` — workflow-specific
   - `.raili/vars.yaml` — shared fallback

   ```yaml
   ticket_id: PROJ-123
   branch: main
   ```

3. **Interactive prompt** (lowest priority, clean runs only)
   ```
   ticket_id: PROJ-123
   branch: main
   description: Fix bug
   ```

## Context & Resumption

Raili saves execution state to `<workflow>/context.json`:
- State history (ordered list of entered states with timestamps)
- Variable values
- Approval responses

### Resume behavior
- `raili run` with existing context → prompts "Continue from existing run (Enter) or clean run (c)?"
- `raili run --continue` → always resumes
- `raili run --clean` → always starts fresh (clears context.json and outputs)

### Named workflow resume behavior
When `--workflow` is given and no `context.json` exists, Raili fails fast — use `--clean` to start a new run.

## Monitoring

### Check last run state
```bash
cat .raili/main/context.json | jq '.stateHistory[-1]'
```

### View stored outputs
```bash
ls -la .raili/main/outputs/
cat .raili/main/outputs/analyze.md       # Output from 'analyze' state
```

## Error Handling

### Fail-fast validation
If any of these fail, execution stops immediately:
- `.raili/` directory missing
- `agent-registry.json` or `script-registry.json` missing or malformed
- Referenced agent or script not found in registries
- Selected workflow directory does not exist
- Declared input variable not defined
- Illegal transition (outcome not mapped)

### Error states
If workflow defines `error: error_state`, engine routes to that state on unhandled exceptions.

## Exit Codes

- `0` — Workflow completed successfully
- `1` — Error during execution (see error message)
- `2` — Invalid command or arguments

## Tips

**Use `--clean` when:**
- Starting a new workflow cycle
- Changing input values
- Debugging from scratch

**Use `--continue` when:**
- Retrying after a failure
- Resuming long-running workflows
- Keeping the same inputs

**Use `--workflow` when:**
- Running a non-default workflow (e.g. a dev or test variant)
- Keeping parallel workflows isolated with separate context and outputs

### Run log (JSONL)

Raili appends a one-line JSON summary to `.raili/<workflow>/run-log.jsonl` when a run reaches a terminal state. Each line contains run metadata useful for longitudinal metrics (runId, inputs, state counts, loops, approval failures, terminalState, duration). Use this file to build trend dashboards or telemetry.

Example:

```bash
cat .raili/main/run-log.jsonl | jq '.[-1]'
```
