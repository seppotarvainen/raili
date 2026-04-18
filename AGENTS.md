# Raili Agent Guide

Raili is a **deterministic CLI workflow orchestrator** for AI-assisted development. It executes explicit state machines with pluggable agent/script execution and full fail-fast validation.

## Core Architecture

**Three-tier separation:**
1. **Workflow Config** (`workflow.yaml`) — Declares states, transitions, inputs, registries
2. **Registries** — Map names to implementations: `agent-registry.json` and `script-registry.json`
3. **Runner** (`runner.ts`) — Controls state transitions deterministically; all routing is explicit

**Key constraint:** No business logic in state definitions. Handlers perform all side effects (agent calls, shell scripts, notifications).

---

## Project Structure

```
src/
  cli.ts                      # Entry point: init, run, help, docs, schema, stats commands
  run.ts                      # Orchestrates load → validate → build → run → log
  init.ts                     # Creates .raili/ scaffold
  types.ts                    # Shared types (StateConfig, WorkflowConfig, etc.)
  cli/
    railiCommand.ts           # CLI command parser (init, run, docs, schema, stats, help)
    help.ts                   # Help text printer (topic-aware)
    docs.ts                   # Built-in docs command
    generatedDocs.ts          # Stable adapter — imports from generatedDocs.json (build artifact, gitignored)
    generatedDocs.json        # DO NOT LOOK AT THIS FILE. Auto-generated docs data (build artifact, gitignored)
    schema.ts                 # Prints workflow YAML schema reference
    schemaFormatter.ts       # Formats schema definitions for display
    stats.ts                  # Run statistics (avg loops, success rate, etc.)
  runner/
    runner.ts                 # Core state machine executor (was Engine.ts)
    stateRunner.ts            # IStateRunner interface
    agentStateRunner.ts       # Runs agent states with prompt interpolation + learnings
    scriptStateRunner.ts      # Runs shell scripts
    commandStateRunner.ts     # Runs inline shell commands
    approveStateRunner.ts     # Manual approval prompts
    stateRunnerUtils.ts       # Shared: env overrides, output storage, expose parsing, outcome resolution
    transition.ts             # Transition resolution (case-insensitive, default key)
  handlers/
    agentHandler.ts           # Spawns copilot CLI agents
    scriptHandler.ts          # Executes registered scripts
    commandHandler.ts         # Executes inline commands
    manualHandler.ts          # User approval + feedback prompt logic
    notifyHandler.ts          # Pre-state notifications (shell commands)
  registry/
    agentRegistry.ts          # Loads & validates agent-registry.json
    scriptRegistry.ts         # Loads & validates script-registry.json
    registryValidator.ts      # Fail-fast: validates registries & workflow references
  workflow/
    workflowLoader.ts         # Loads & merges workflow.yaml + sub-workflows
    schemaValidator.ts        # Runtime schema validation for workflow config
    schemas.ts                # Schema definitions (mirrors types.ts, enumerable at runtime)
  context/
    context.ts                # Persists execution state to context.json
    outputStore.ts            # Saves agent/script outputs per run
    learningStore.ts          # Extracts & persists agent learnings (LESSON: markers)
    pathUtils.ts              # resolveWorkflowDir, resolveRegistryPath, learningsFilePath
    runLog.ts                 # Appends per-run summary to run-log.json
  variables/
    variableInterpolation.ts  # Interpolates ${VAR_NAME} in prompts & commands
    variableExports.ts        # Parses KEY=VALUE exports from stdout
    varsLoader.ts             # Loads .raili/<workflow>/vars.yaml

.raili/
  agent-registry.json         # {agent_id: {path, model?}}
  script-registry.json        # {script_id: {path}}
  main/                       # Default workflow directory
    workflow.yaml             # State machine definition
    vars.yaml                 # Workflow-specific variables
    context.json              # Runtime state (stateHistory, vars) — persisted
    outputs/                  # Saved agent/script outputs per state
    learnings/                # Persistent agent learnings (<agentId>.md)
  <workflow-name>/            # Additional named workflows (same structure as main/)
```

---

## Workflow Execution Flow

1. **Init** (`raili init`) → Creates `.raili/` with template files
2. **Load & Validate** → Reads workflow.yaml, registries, checks all references exist (fail-fast)
3. **Build State Machine** → Converts workflow config to explicit state DAG with typed transitions
4. **Run Loop** → Runner (`runner.ts`) executes phases per state:
   - **Phase 1 – Skip:** If `skip` is set, bypass state and jump to target
   - **Phase 2 – Enter:** Enforce `max_visits`, run `reset_outputs`, record in history, fire `notify`
   - **Phase 3 – Terminal check:** If no routing defined → terminal state (persist `success` flag, stop)
   - **Phase 4 – Execute:** Route to state runner (agent/script/command/engine type)
   - **Phase 5 – Exports:** Merge `expose` variables from stdout into context
   - **Phase 6 – Approval:** If `approval` configured, prompt user and route
   - **Phase 7 – Feedback:** If `feedback` configured, collect user input and expose as variable
   - **Phase 8 – Route:** Resolve next state via `on` (binary) or `transitions` (named)
5. **Persist** → Context saved to `.raili/<workflow>/context.json` after each state entry
6. **Run Log** → `runLog.ts` appends per-run summary (duration, loops, terminal state) to `run-log.json`

**Resume behavior:** On next `raili run`, loads context.json and resumes from last entered state.

---

## Registries & Fail-Fast Validation

All references **must be explicit and validated before execution starts:**

- `agent-registry.json`: Maps agent IDs → `{path, model?}`
  - Path resolved relative to project root (e.g., `.github/agents/analyzer.md`)
  - Model in frontmatter or registry can be overridden per state
- `script-registry.json`: Maps script IDs → `{path}`
- **Validation:** `registry/registryValidator.ts` checks every referenced file exists
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
2. `.raili/<workflow>/vars.yaml` — workflow-specific vars (e.g. `.raili/main/vars.yaml`)
   - Falls back to `.raili/vars.yaml` — shared across all workflows
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

- **Fail-fast (default):** The interpolation utility (`src/variables/variableInterpolation.ts`) throws on missing variables by default.
- **YAML-style exceptions for prompts/questions:** Agent prompts and approval questions intentionally use YAML-style interpolation — missing variables are substituted with an empty string instead of throwing. This behavior is implemented in `src/runner/agentStateRunner.ts` and `src/runner/approveStateRunner.ts` (they call the interpolator with `{ throwOnMissing: false, missingValue: '' }`).

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
  store: true            # Save to .raili/<workflow>/outputs/<stateId>.md
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

- **Unit tests** for core runner (`runner.test.ts`) and all state runners/handlers
  - Test all transition types (binary, named, terminal, error routing)
  - Test illegal transitions (throw error immediately)
  - Test `max_visits` enforcement
  - Test `reset_outputs`, `notify` entry actions
  - Test `skip`, `expose`, `feedback`, `success` flag, `teach` behaviors
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
  - Feedback prompts are automated by setting `process.env.RAILI_FEEDBACK_<UPPERCASE_NAME>` to the desired value.
  - Integration tests may assert on on-disk artifacts inside the temp workspace (for example `.raili/main/outputs/<stateId>.md` and `.raili/main/context.json`) to ensure output storage and context persistence work as expected.
  - Use `cleanupRailiEnvVars()` from `testUtils.ts` in `afterEach` to remove `RAILI_VAR_*`, `RAILI_FEEDBACK_*`, and `RAILI_MANUAL_CHOICE` env vars.

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
| Add new state type | `types.ts` (StateType union), `workflow/workflowLoader.ts` (build routing), `runner/runner.ts` (add runner), new `runner/*stateRunner.ts` |
| Add new registry type | `registry/registryValidator.ts`, new registry loader/validator |
| Change variable interpolation | `variables/variableInterpolation.ts`, test: `variableInterpolation.test.ts` |
| Modify agent model override | `runner/agentStateRunner.ts`, `handlers/agentHandler.ts` (frontmatter parsing) |
| Add error recovery | `runner/runner.ts` (error state routing already supported), add error state handling |
| Change approval flow | `runner/approveStateRunner.ts`, `handlers/manualHandler.ts` |
| Modify output filtering | `context/outputStore.ts` (tail/regex logic) |
| Change feedback collection | `handlers/manualHandler.ts` (handleFeedbackPrompt), `runner/runner.ts` (handleFeedback phase) |
| Add/modify agent learnings | `context/learningStore.ts`, `runner/agentStateRunner.ts` (teach processing) |
| Change run statistics | `cli/stats.ts` (computeMetrics), `context/runLog.ts` (appendRunLog) |
| Change variable export parsing | `variables/variableExports.ts` (parseExports), `runner/stateRunnerUtils.ts` (parseExposedVars) |

---

## Example Workflow Structure

See `documentation/` for complete reference (states.md, routing.md, variables.md, etc.). Minimal example:

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


