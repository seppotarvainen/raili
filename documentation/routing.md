# Routing

> A state must have EXACTLY ONE of: on, transitions, or approval. Binary (on:) maps exit codes. Named (transitions:)
> maps outcome keys. Approval prompts the user.

## Binary Routing (on:)

Maps exit codes to next states. Code 0 = PASSED, non-zero = FAILED.

```yaml
on:
  PASSED: next_state      # exit code 0
  FAILED: error_state     # exit code non-zero
```

**Use for:** script, command states

**NOT suitable for agents** — Copilot agents always exit code 0.

## Named Routing (transitions:)

Maps outcome keys (from last line of stdout) to next states. The agent/script/command must print the key as its last
line.

```yaml
transitions:
  approve: merge_state
  reject: fix_state
  blocked: done
```

**Use for:** agent, script, command states

**MUST use for agents** — this is the correct routing mechanism.

## Manual Approval (approval:)

Pauses execution and prompts the user for yes/no.

```yaml
approval:
  question: "Proceed with deployment?"
  notify: "alert.sh"      # Optional: run before prompt
  PASSED: deploy          # user approves (Enter)
  FAILED: rework          # user rejects (type anything)
```

**Use for:** any state type

## Terminal State

No `on`, `transitions`, or `approval` defined. Workflow stops here.

```yaml
done:
  type: engine
  notify: "echo 'Complete'"
```

## Important Notes

- Agents always exit code 0 regardless of internal logic → use `transitions:` not `on:`
- A state may not have multiple routing options — exactly one required
- Missing routing key in `transitions:` → workflow error
- Variables can be used in approval questions with `${variable_name}` syntax

