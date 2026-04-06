# Output

> Output storage maintains agent memory across runs. Configure filtering to keep only relevant lines and tail to bound
> context size.

## Basic Storage

Store the output of any state:

```yaml
output:
  store: true
```

Output saved to `.raili/<workflow>/outputs/<stateId>.md` with run separators.

Note: For group (sub-workflow) states the on-disk filename uses only the sub-state name (the final segment of the virtual state id). For example a sub-state with virtual id `groupx.produce` is stored as `produce.md` (no parent prefix).

## Marker-based Extraction

Use optional `marker` and `marker_end` strings to capture the portion of output to persist. Searches are **case-insensitive** but slicing preserves the original casing and spacing.

Rules:

- If neither `marker` nor `marker_end` are provided, the **full stdout** is persisted (existing behavior).
- If only **`marker`** is provided → the first occurrence of `marker` (case-insensitive) is located and **everything after it** is persisted.
- If only **`marker_end`** is provided → the first occurrence of `marker_end` is located and **everything before it** is persisted.
- If **both** `marker` and `marker_end` are provided → the engine finds the first `marker` and the first `marker_end` that occurs **after** the found start and persists the substring **between** them. If `marker_end` is not found after `marker`, the engine behaves like the `marker`-only case (everything after `marker`).

YAML example (both markers):

```yaml
output:
  store: true
  marker: "//SUMMARY//"
  marker_end: "//SUMMARY_END//"
```

This is useful for agent outputs that include clear delimiters surrounding the structured content to persist (for example a `//SUMMARY//` block). If you previously relied on an implicit `"OUTPUT:"` default, note that there is no longer a default marker — provide `marker` explicitly when you want marker-based extraction.

## Tail (Keep Last N Lines)

Keep only the last N lines:

```yaml
output:
  store: true
  tail: 100
```

## Combined Filtering

Marker extraction (using `marker` and/or `marker_end`) and `tail` work together.

```yaml
output:
  store: true
  marker: "SUMMARY:"
  marker_end: "SUMMARY_END:"
  tail: 200
```

Process: first extract according to the configured markers (see rules in "Marker-based Extraction") → then apply `tail` to keep only the last N lines of the extracted content.

## Agent Memory Strategy

Full history is always stored on disk for audit trail. Use `use_latest` to control how many of the most recent stored runs are injected into the agent prompt.

- Omitted (default): **all** stored outputs are injected into the agent prompt.
- `use_latest: 5`: inject only the most recent 5 stored runs (useful for bounding context on long-running workflows).
- `use_latest: 1`: inject only the latest stored run.

Learnings (opt-in): States may declare a `teach:` mapping to push lessons to agents from outputs or variables. Learnings are stored at `.raili/<workflow>/learnings/<agentId>.md` and are injected into the agent prompt under `## Learnings from previous runs` before execution. Learnings are deduplicated on append to avoid loops.

Note: when injecting learnings into agent prompts, source tags (e.g., `[var:...]`, `[manual]`, `[output:state]`) are removed; only the lesson bodies are included as bullet-prefixed items to reduce token usage and improve readability.

Interaction with approvals

When an approval is answered with a typed reason (FAILED), or when an approval resolver returns a structured result containing a `reason`, Raili mirrors that non-empty reason into `context.vars` using the key `<STATE>_<OUTCOME>` (uppercased). The Runner processes a state's `teach:` mappings after approvals are handled and approval-exposed variables are available, so `teach:` can reference approval-produced variables (for example `${REVIEW_FAILED}`) declared on the same state. This ensures learnings can be created directly from user-provided or resolver-produced approval reasons in the originating state.

Additionally, feedback resolvers that return structured objects with a `metadata` field have that metadata persisted under `context.feedbacks` (keyed by state id) and recorded in the state's `meta.feedback.metadata` entry inside `context.stateHistory`. The `feedback` value itself is still mirrored into `context.vars` under the declared `expose_var` so notify commands and scripts can read it via `$RAILI_VAR_<UPPERCASE>`. Feedback metadata is intentionally not exported as environment variables; it is stored for audit and tooling purposes.
## Common Patterns

### Test state — capture failures

```yaml
test:
  type: script
  script: npm-test
  output:
    store: true
    marker: "FAILURE_SUMMARY:"
    tail: 200
```

### Build state — bounded logs

```yaml
build:
  type: command
  command: npm run build
  output:
    store: true
    tail: 100
```

### Agent state — full memory

```yaml
code:
  type: agent
  agent: coder
  output:
    store: true
```

### Analysis state — filtered output

```yaml
analyze:
  type: agent
  agent: analyzer
  output:
    store: true
    marker: "SUMMARY:"
    tail: 150
```

## Resetting Memory

Clear a state's output when starting a new cycle:

```yaml
start_cycle:
  type: engine
  reset_outputs:
    - code          # clear code's memory
    - test          # clear test's memory
```

This is useful when looping back to retry after failures.

## Full History

The complete history file contains all runs with separators:

```
--- Run 2026-03-13T08:15:00Z ---
[output from first run]

--- Run 2026-03-13T08:20:30Z ---
[output from second run]

--- Run 2026-03-13T08:25:15Z ---
[output from third run]
```

On disk for audit trail. By default Raili injects **all** stored outputs into the agent prompt; use `use_latest` to limit how many recent runs are injected to bound context.

### Run log JSONL

For longitudinal metrics, Raili also writes a compact JSONL run log to `.raili/<workflow>/run-log.jsonl`. Each line is a single JSON object summarizing the run (runId, declared input vars, state counts, loops, approvalFailures, terminalState, duration). This file is append-only and safe to read concurrently. Only input variables declared in the workflow with `log: true` are included in the `vars` object — all other inputs are excluded by default.

The canonical success indicator field in each run object is `success` (boolean). Older legacy `successful` field is no longer supported.

