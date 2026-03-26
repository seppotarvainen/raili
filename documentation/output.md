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

## Marker-based Extraction

Use a marker string to capture the section of output to persist. The first case-insensitive occurrence of the marker is used and everything after it is stored. If the marker is not found, the entire stdout is persisted.

```yaml
output:
  store: true
  marker: "OUTPUT:"
```

This is useful for agent outputs that include a clear delimiter (e.g. `SUMMARY:`) followed by the structured content to keep.

## Tail (Keep Last N Lines)

Keep only the last N lines:

```yaml
output:
  store: true
  tail: 100
```

## Combined Filtering

Marker extraction and tail work together:

```yaml
output:
  store: true
  marker: "SUMMARY:"
  tail: 200
```

Process: extract content after the first marker occurrence → keep last 200 lines

## Agent Memory Strategy

Only the **last run** is appended to the agent's prompt on next invocation (not full history). This keeps context
bounded while maintaining iterative memory.

Full history is always stored on disk for audit trail.

Learnings (opt-in): Agent states may declare `learn_from:` to collect persistent, append-only learnings from other outputs or variables. Learnings are stored at `.raili/<workflow>/learnings/<agentId>.md` and are injected into the agent prompt under `## Learnings from previous runs` before execution. Learnings are deduplicated on append to avoid loops.

Note: when injecting learnings into agent prompts, source tags (e.g., `[var:...]`, `[manual]`, `[output:state]`) are removed; only the lesson bodies are included as bullet-prefixed items to reduce token usage and improve readability.

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

On disk for audit trail, but only last run injected into agent prompt (bounded context).

### Run log JSONL

For longitudinal metrics, Raili also writes a compact JSONL run log to `.raili/<workflow>/run-log.jsonl`. Each line is a single JSON object summarizing the run (runId, declared input vars, state counts, loops, approvalFailures, terminalState, duration). This file is append-only and safe to read concurrently. Only input variables declared in the workflow with `log: true` are included in the `vars` object — all other inputs are excluded by default.

The canonical success indicator field in each run object is `success` (boolean). Older legacy `successful` field is no longer supported.

