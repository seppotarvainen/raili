# run

> Validate and execute your workflow. Runs the state machine from the current or initial state until a terminal state is reached.

## Usage

```bash
raili run                    # Resume from last state or start fresh if prompted
raili run --clean           # Force a clean run (clear context, reprompt for inputs)
raili run --continue        # Resume from last state (error if no context)
raili run --var key=value   # Supply workflow inputs
```

## Examples

### Basic run
```bash
raili run
# If context.json exists, resumes from last state
# If not, prompts for clean vs continue
```

### Clean run with inputs
```bash
raili run --clean --var ticket_id=PROJ-123 --var branch=main
```

### Using an alternate workflow file
```bash
# Prefer .raili/workflow-dev.yaml if present, otherwise uses ./workflow-dev.yaml
raili run --workflow workflow-dev.yaml --clean --var ticket_id=PROJ-123
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

## Execution Flow

1. **Load & Validate** → Reads `.raili/` directory, registries, and workflow
2. **Initialize Context** → On clean run, prompts for declared inputs; on continue, reuses saved variables
3. **Build State Machine** → Converts workflow.yaml into runtime state DAG
4. **Run Loop** → Executes states in order:
   - Enter state (run notify hook if present)
   - Clear outputs (if reset_outputs specified)
   - Execute handler (agent, script, command, or engine)
   - Route based on outcome
   - Save context to `.raili/context.json`
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

2. **`.raili/vars.yaml`** (optional, git-ignored)
   ```yaml
   ticket_id: PROJ-123
   branch: main
   ```

3. **Interactive prompt** (lowest priority)
   ```
   ticket_id: PROJ-123
   branch: main
   description: Fix bug
   ```

## Context & Resumption

Raili saves execution state to `.raili/context.json`:
- State history (ordered list of entered states with timestamps)
- Variable values
- Approval responses

### Resume behavior
- `raili run` with existing context → prompts "Continue from existing run (Enter) or clean run (c)?"
- `raili run --continue` → always resumes
- `raili run --clean` → always starts fresh (clears context.json)

## Monitoring

### Check last run state
```bash
cat .raili/context.json | jq '.stateHistory[-1]'
```

### View stored outputs
```bash
ls -la .raili/outputs/
cat .raili/outputs/analyze.md       # Output from 'analyze' state
```

## Error Handling

### Fail-fast validation
If any of these fail, execution stops immediately:
- `.raili/` directory missing
- `agent-registry.json` or `script-registry.json` missing or malformed
- Referenced agent or script not found in registries
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

**Use `--var` when:**
- Running in CI/CD (non-interactive)
- Passing dynamic values from scripts
- Overriding defaults

