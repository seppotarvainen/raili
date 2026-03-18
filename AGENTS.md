# Raili Agent Guide

Raili is a **deterministic CLI workflow orchestrator** for AI-assisted development. It executes explicit state machines with pluggable agent/script execution and full fail-fast validation.

## Core Architecture

**Three-tier separation:**
1. **Workflow Config** (`workflow.yaml`) — Declares states, transitions, inputs, registries
2. **Registries** — Map names to implementations: `agent-registry.json` and `script-registry.json`
3. **Engine** (`Engine.ts`) — Controls state transitions deterministically; all routing is explicit

**Key constraint:** No business logic in state definitions. Handlers perform all side effects (agent calls, shell scripts, notifications).

---

## Project Structure

```
src/
  cli.ts                      # Entry point: init, run, help commands
  engine/
    Engine.ts                 # Core state machine executor
    AgentStateRunner.ts       # Runs agent states with prompt interpolation
    ScriptStateRunner.ts      # Runs shell scripts
    CommandStateRunner.ts     # Runs inline shell commands
    ApproveStateRunner.ts     # Manual approval prompts
  handlers/
    agentHandler.ts           # Spawns copilot CLI agents
    scriptHandler.ts          # Executes registered scripts
    commandHandler.ts         # Executes inline commands
    manualHandler.ts          # User approval logic
    notifyHandler.ts          # Pre-state notifications (shell commands)
  registryValidator.ts        # Fail-fast: validates registries & references
  workflowLoader.ts           # Loads & merges workflow.yaml + sub-workflows
  context.ts                  # Persists execution state to context.json
  outputStore.ts              # Saves agent/script outputs
  variableInterpolation.ts    # Interpolates ${VAR_NAME} in prompts & commands

.raili/
  workflow.yaml               # State machine definition (lives in project)
  agent-registry.json         # {agent_id: {path, model?}}
  script-registry.json        # {script_id: {path}}
  context.json                # Runtime state (stateHistory, vars) — persisted
  outputs/                    # Saved agent/script outputs
```

---

## Workflow Execution Flow

1. **Init** (`raili init`) → Creates `.raili/` with template files
2. **Load & Validate** → Reads workflow.yaml, registries, checks all references exist (fail-fast)
3. **Build State Machine** → Converts workflow config to explicit state DAG with typed transitions
4. **Run Loop** → Engine:
   - On state entry: run `reset_outputs` (clear prior state outputs), run `notify` (pre-state hook)
   - Enforce `max_visits` limit
   - Route to state runner (agent/script/command/engine type)
   - State returns outcome: `"PASSED"`, `"FAILED"`, or named key from `transitions`
   - Resolve next state via `on` (binary) or `transitions` (named) routing
   - If no routing defined → terminal state (stop)
5. **Persist** → Context saved to `.raili/context.json` after each state entry

**Resume behavior:** On next `raili run`, loads context.json and resumes from last entered state.

---

## Registries & Fail-Fast Validation

All references **must be explicit and validated before execution starts:**

- `agent-registry.json`: Maps agent IDs → `{path, model?}`
  - Path resolved relative to project root (e.g., `.github/agents/analyzer.md`)
  - Model in frontmatter or registry can be overridden per state
- `script-registry.json`: Maps script IDs → `{path}`
- **Validation:** `registryValidator.ts` checks every referenced file exists
- **Missing file?** → Throws immediately, no silent fallbacks

Example:
```json
{
  "analyzer": {"path": ".github/agents/analyzer.md", "model": "gpt-4o"}
}
```

---

## State Types & Routing

| Type | Behavior | Routing |
|------|----------|---------|
| `agent` | Spawns copilot CLI agent via `agentHandler.ts` | `transitions` (named keys) — agent prints last line of stdout |
| `script` | Executes shell script with cwd context | `on` (binary: exit code 0=PASSED) or `transitions` |
| `command` | Inline shell command | `on` or `transitions` |
| `engine` | No-op state (always returns PASSED) | `on` or `transitions` |

**Routing rules:**
- A state must have **exactly one** of: `on`, `transitions`, or `approval`
- `on: {PASSED: "next_state", FAILED: "error_state"}` — binary exit code based
- `transitions: {approve: "s1", reject: "s2"}` — outcome key from state output
- `approval: {question: "...", PASSED: "s1", FAILED: "s2"}` — manual user confirmation with optional pre-prompt notification
- No routing defined → Terminal state (execution stops)

---

## Manual Approval States

States can pause execution and prompt the user for manual approval before routing:

```yaml
review:
  type: engine
  approval:
    question: "Does this look good? (yes/no)"
    notify: "notify_team.sh"    # Optional: run shell command before showing prompt
    PASSED: "merge"              # Route here if user approves
    FAILED: "rework"             # Route here if user rejects
```

**Behavior:**
- Engine pauses and displays the question to the user
- Optional `notify` runs before the prompt (e.g., to alert reviewers)
- User response routes to either PASSED or FAILED state
- Like other state outcomes, approval responses are recorded in `context.json`

**Key difference from `transitions:`**
- `transitions:` expects the state itself to output a routing key (last stdout line)
- `approval:` explicitly asks the user for yes/no and is not tied to automated state logic

---

## Variable Interpolation

**Syntax:** `${VARIABLE_NAME}` in agent prompts, commands, notifications

**Sources (precedence):**
1. `--var key=value` CLI flags
2. `.raili/vars.yaml` (only keys declared in `workflow.inputs`)
   - Additionally, when you run a specific workflow file via `--workflow <path>` the CLI will look for workflow-scoped files in `.raili/` before falling back to `vars.yaml`:
     - `.raili/vars.<suffix>.yaml` (preferred)
     - `.raili/vars-<suffix>.yaml`
     - `.raili/vars.<suffix>.yml`
     These candidates derive the <suffix> from the basename of the workflow file (see `src/cli.ts::loadVarsFile`).
3. Interactive prompt (for declared inputs not supplied via flags)
   - Note: interactive prompting only occurs for clean runs. When continuing a previous run the engine reuses values from `.raili/context.json` instead of prompting.

**Example workflow input:**
```yaml
initial: start
inputs: [ticket_id, branch]
states:
  analyze:
    type: agent
    agent: analyzer
    prompt: "Analyze ticket ${ticket_id} on branch ${branch}"
```

**Environment variable exposure:**
- All vars exported as `RAILI_VAR_<UPPERCASE>` for shell scripts & notifications
- Access in commands: `$RAILI_VAR_TICKET_ID`

- **Fail-fast (default):** The interpolation utility (`src/variableInterpolation.ts`) throws on missing variables by default.
- **YAML-style exceptions for prompts/questions:** Agent prompts and approval questions intentionally use YAML-style interpolation — missing variables are substituted with an empty string instead of throwing. This behavior is implemented in `src/engine/AgentStateRunner.ts` and `src/engine/ApproveStateRunner.ts` (they call the interpolator with `{ throwOnMissing: false, missingValue: '' }`).

---

## Handler Patterns

Each handler follows the same pattern: **receive input → perform side effect → return outcome string.**

Example: `agentHandler.ts`
```typescript
export async function executeAgent(
  registry: AgentRegistry,
  agentId: string,
  cwd: string,
  previousOutputPath?: string | null,
  prompt?: string
): Promise<AgentExecutionResult>
```

- Loads agent file from registry
- Reads frontmatter for model (can be overridden)
- Appends previous output as context (if `output.store` was enabled)
- Spawns copilot CLI process
- Returns `{success: boolean, stdout: string, stderr: string}`

**Mocking:** All handlers are mocked in tests. External calls (LLM, shell) are never executed during testing.

---

## Output Storage & Context

**Output configuration** (optional on any state):
```yaml
output:
  store: true            # Save to .raili/outputs/<stateId>.md
  tail: 100             # Keep last 100 lines
  include_search_pattern: "Error|WARNING"  # Regex filter
  include_after: 5      # Include 5 lines after matches
```

**Context persists:**
- State history (ordered list of state entries with timestamps)
- Variables (input values collected or supplied)
- On resume, agent handlers load previous output and append it to the prompt

---

## Testing Policy (Strict)

- **Unit tests only** for core engine (`engine.test.ts`)
  - Test all transition types (binary, named, terminal, error routing)
  - Test illegal transitions (throw error immediately)
  - Test `max_visits` enforcement
  - Test `reset_outputs`, `notify` entry actions
- **Mock all external side effects** (`jest.mock()`)
  - Never call real copilot CLI
  - Never spawn real shell processes
  - Never write real files (use in-memory mocks)
- Test registry validation, error states, loopbacks

Run tests: `npm test` (uses `--runInBand` to avoid race conditions)

### Integration tests

- Location: `__tests__/integration` — these are the project's integration-style tests.
- Purpose: exercise the engine end-to-end inside a temporary workspace while still avoiding real external side effects. Integration tests validate the full control flow (state entry, notify, runners, routing, context persistence, and output storage) using lightweight process and filesystem simulation.
- Style & patterns used in this repo:
  - Tests create a sandboxed temporary workspace using helpers from `__tests__/integration/testUtils.ts` (e.g. `createTmpWorkspace`, `writeWorkflow`, `writeAgentRegistry`, `writeAgentFile`, `writeScriptRegistry`). These helpers write real files under a temp dir so workflows and `.raili/` are exercised.
  - External processes are mocked with `jest.mock('child_process')` and a `fakeChild` helper that simulates `stdout`, `stderr`, and an exit code. See `__tests__/integration/*` (for example `agent.test.ts` and `command.test.ts`) for usage.
  - Integration tests still DO NOT spawn real external programs — they stub `spawn` to return controlled outputs. This keeps tests deterministic and fast while verifying interactions (commands invoked, env vars exported, notify commands executed).
  - To assert notify/command execution, tests inspect `spawn.mock.calls` and check for `sh -c <command>` or `copilot` invocations.
  - Approval prompts are automated in tests by setting `process.env.RAILI_MANUAL_CHOICE` to `PASSED` or `FAILED` before `runCommand` so the approval flow can be exercised without human input.
  - Integration tests may assert on on-disk artifacts inside the temp workspace (for example `.raili/outputs/<stateId>.md` and `.raili/context.json`) to ensure output storage and context persistence work as expected.

Examples (patterns to copy):

- Mocking `spawn` and simulating a copilot run that returns a transition key on the last stdout line:

  - `jest.mock('child_process', () => ({ spawn: jest.fn() }));`
  - `spawn.mockImplementation((cmd) => cmd === 'copilot' ? fakeChild('analysis\napprove','',0) : fakeChild('', '', 0));`

- Creating a temp workspace and running the engine:

  - `const tmp = createTmpWorkspace(); writeWorkflow(tmp, '...'); writeAgentRegistry(tmp, {...}); await runCommand(tmp, 'clean', {});`

- Asserting the final state via context and verifying output files:

  - `const ctx = loadContext(tmp); expect(ctx.stateHistory[ctx.stateHistory.length - 1].state).toBe('done');`
  - `expect(fs.existsSync(path.join(tmp, '.raili', 'outputs', 'analyze.md'))).toBe(true);`

Keep integration tests focused on control-flow and I/O boundaries (context, outputs, notify, approvals) and rely on unit tests for detailed handler logic.

---

## CLI Commands & Dev Workflow

```bash
npm run build           # Compile TypeScript → dist/
npm test               # Run Jest (mocked tests only)
npm run lint           # Echo (no linter configured yet)

# Dev mode (TypeScript direct)
npx ts-node src/cli.ts init
npx ts-node src/cli.ts run --var ticket_id=TICKET-123

# Production
npm run build
npm install -g .       # Install CLI globally
raili init
raili run --var ticket_id=TICKET-456
```

---

## Fail-Fast Behavior (Non-Negotiable)

- `.raili/` missing → error before any execution
- Registry files missing/malformed → error immediately
- Workflow references agent/script not in registry → error immediately
- Illegal transition (outcome not mapped) → error immediately
- Variable not defined → error immediately
- State entered more than `max_visits` times → error immediately

**Philosophy:** Fail early with clear error messages. No silent fallbacks. All errors are developer responsibility.

---

## Key Files for Specific Tasks

| Task | Key Files |
|------|-----------|
| Add new state type | `types.ts` (StateType union), `workflowLoader.ts` (build routing), `Engine.ts` (add runner), new `*StateRunner.ts` |
| Add new registry type | `registryValidator.ts`, new registry loader/validator |
| Change variable interpolation | `variableInterpolation.ts`, test: `variableInterpolation.test.ts` |
| Modify agent model override | `AgentStateRunner.ts`, `agentHandler.ts` (frontmatter parsing) |
| Add error recovery | `Engine.ts` (error state routing already supported), add error state handling |
| Change approval flow | `ApproveStateRunner.ts`, `manualHandler.ts` |
| Modify output filtering | `outputStore.ts` (tail/regex logic) |

---

## Example Workflow Structure

See `docs/workflow-yaml.md` for full reference. Minimal example:

```yaml
initial: start
inputs: [ticket_id]

states:
  start:
    type: agent
    agent: analyzer
    prompt: "Analyze ticket ${ticket_id}"
    transitions:
      approve: "merge"
      reject: "fix"

  fix:
    type: script
    script: run_tests
    on:
      PASSED: "start"
      FAILED: "error_state"

  merge:
    type: engine

  error_state:
    type: engine
    notify: "send_alert.sh"
```

---

## Architecture Decisions

1. **Explicit state machine** (not dynamic DSL) → simpler, testable, fail-fast
2. **Registries as JSON** → simple config, easy to validate
3. **Handlers are pure functions** → testable, mockable
4. **Context persists** → resumable workflows, auditable history
5. **No recovery logic in core** → error states handle failures
6. **Variable interpolation via ${} syntax** → explicit, familiar, YAML-safe


