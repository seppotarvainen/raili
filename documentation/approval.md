# Approval

> Manual approval pauses the workflow and prompts the user for yes/no before routing.

## Approval Block

An approval state pauses execution after its handler and asks the user a question:

```yaml
review:
  type: engine
  approval:
    question: "Does this look good?"
    PASSED: deploy
    FAILED: rework
```

**User interaction:**
- Question displayed: "Does this look good? "
- Press **Enter** → routes to PASSED state
- Type **anything** → routes to FAILED state

There is an optional multiline mode (see below).

## Approval Fields

| Field      | Required  | Type   | Description                                                           |
|------------|-----------|--------|-----------------------------------------------------------------------|
| `question` | ✅         | string | Question shown to the user. Supports `${variable_name}` interpolation |
| `PASSED`   | ✅         | string | Next state if user presses Enter                                      |
| `FAILED`   | ✅         | string | Next state if user types a reason                                     |
| `notify`   | ❌         | string | Shell command run BEFORE the prompt (e.g., alert reviewers)           |
| `multiline`| ❌         | boolean| When true, allow the user to enter multiple lines as a reason; terminate input with a line containing only `/q` |

## With Optional Notification

Send an alert before showing the prompt:

```yaml
review:
  type: engine
  approval:
    notify: "msg.sh 'Review needed for ticket $RAILI_VAR_TICKET_ID'"
    question: "Deploy to production?"
    PASSED: deploy
    FAILED: rework
```

The notification runs after the state handler completes but before the user is prompted.

## Multiline approval

Enable multiline input for richer rejection reasons:

```yaml
review:
  type: engine
  approval:
    multiline: true
    question: |
      The diff is large. Please provide a reason for rejection (finish with /q):
    PASSED: continue
    FAILED: rework
```

Behavior:
- Raili collects lines from stdin until a line containing only `/q` is entered (that `/q` line is not included in the saved reason).
- If the assembled reason is empty (user entered `/q` immediately), the answer is treated as PASSED.
- If the assembled reason contains any text, the answer is treated as FAILED and the full multiline reason is persisted.

## With Variable Interpolation

Use `${variable_name}` in questions:

```yaml
review:
  type: script
  script: lint
  approval:
    question: |
      Update ticket ${ticket_id}?
      Branch: ${branch}
      Changes: ${description}
      
      Approve?
    PASSED: deploy
    FAILED: code
```

Missing variables → immediate error (fail-fast).

## Approval Response Tracking

Approval questions, answers, and any notify metadata are recorded in `context.json` as part of the originating state's history entry under a `meta` object. When manual prompts or feedback incur idle wait time, Raili records `meta.waitMs` (milliseconds) for that state — this represents the total time spent waiting for human input and is persisted to make runs auditable.

Example:

```json
{
  "stateHistory": [
    {"state": "code", "enteredAt": "2026-03-13T08:15:00Z"},
    {
      "state": "review",
      "enteredAt": "2026-03-13T08:16:30Z",
      "meta": {
        "approval": { "question": "Does this look good?", "chosen": "PASSED", "reason": "" },
        "waitMs": 120000,
        "notify": { "command": "msg.sh 'Review needed'", "success": true }
      }
    }
  ]
}
```

Raili's run-log computation (`.raili/<workflow>/run-log.jsonl`) now subtracts accumulated `meta.waitMs` across the run from the total recorded duration. This produces a `duration` value representing active processing time (total run wall-clock time minus human idle waits). The run-log line also includes `waitMs` so both active and idle times are available for analysis.

## Key Differences from transitions:

- **`transitions:`** — outcome from state's stdout output (automated)
- **`approval:`** — outcome from user's keyboard input (manual)

## Common Patterns

### Pre-deployment review
```yaml
deploy:
  type: engine
  approval:
    notify: "msg.sh 'Deploy review required'"
    question: "Deploy to production?"
    PASSED: deploy_prod
    FAILED: abort
```

### Code review with context
```yaml
review:
  type: script
  script: show_changes
  approval:
    question: |
      Changes for ticket ${ticket_id}:
      ${description}
      
      Merge?
    PASSED: merge
    FAILED: edit
```

### Multi-step approval
```yaml
step1_review:
  type: engine
  approval:
    question: "Pass step 1?"
    PASSED: step2_review
    FAILED: rework

step2_review:
  type: engine
  approval:
    question: "Pass step 2?"
    PASSED: complete
    FAILED: rework

## Approval reason persistence

When a user declines an approval and supplies a typed reason, Raili persists that reason in two places in the workflow context:

- `context.approvals`: a dedicated map keyed by `<STATE>_<OUTCOME>` (uppercased) containing the reason text. Example: `"REVIEW_FAILED": "Needs changes"
- `context.vars`: the same key/value is mirrored into the vars map so existing notify/command logic can access the reason via the environment variable mapping (e.g. `$RAILI_VAR_REVIEW_FAILED`).

Only non-empty typed reasons are persisted. PASSED approvals do not create empty entries. This keeps approval metadata separate from declared inputs while preserving env-compatible access for shell hooks.
```

