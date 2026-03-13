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

## Approval Fields

| Field      | Required  | Type   | Description                                                           |
|------------|-----------|--------|-----------------------------------------------------------------------|
| `question` | ✅         | string | Question shown to the user. Supports `${variable_name}` interpolation |
| `PASSED`   | ✅         | string | Next state if user presses Enter                                      |
| `FAILED`   | ✅         | string | Next state if user types a reason                                     |
| `notify`   | ❌         | string | Shell command run BEFORE the prompt (e.g., alert reviewers)           |

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

User responses are recorded in `context.json`:

```json
{
  "stateHistory": [
    {"state": "code", "enteredAt": "2026-03-13T08:15:00Z"},
    {"state": "review", "enteredAt": "2026-03-13T08:16:30Z"},
    {"approval": "PASSED", "enteredAt": "2026-03-13T08:17:00Z"}
  ]
}
```

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
```

