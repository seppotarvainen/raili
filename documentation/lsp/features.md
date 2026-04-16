# LSP Features Reference

## Supported Features

### Goto Definition
Jump to state declaration from routing reference.

Works in these contexts:
- `on: {PASSED: state_name, FAILED: state_name}`
- `transitions: {key: state_name}`
- `approval: {PASSED: state_name, FAILED: state_name}`
- `skip: state_name`
- `continue: state_name`

Usage: Cmd+Click on state name (macOS), Ctrl+Click (Windows/Linux)

### Find References
List all places where a state is used.

Shows definition + all routing references to that state.

Usage: Right-click state → Find Usages

### Hover
Display state metadata when mouse over state name.

Shows:
- State type (agent, script, command, engine, group)
- Routing configuration (if any)
- Key properties

### Rename
Safely rename state and update all references.

Updates state definition + all references in routing contexts.
Does NOT update state names in strings (command, prompt, etc).

Usage: Shift+F6

### Diagnostics
Real-time validation with error squiggles.

Detects:
- Undefined state references
- Typos in state names
- Invalid routing

## What Works

State references are recognized in:
- `on:` blocks
- `transitions:` blocks
- `approval:` blocks (PASSED/FAILED keys only)
- `skip:` values
- `continue:` values
- Inline mappings: `on: {PASSED: state}`

## What Doesn't Work (Not LSP scope)

- Agent/script ID validation
- Variable interpolation validation
- Cross-file navigation (groups, embeds)
- State names in strings (command, prompt)
- Registry file references

## Approval Blocks

LSP correctly handles approval blocks:

```yaml
approval:
  multiline: true           # Ignored
  notify: say "message"     # Ignored
  question: "Continue?"     # Ignored
  PASSED: next_state        # State reference
  FAILED: error_state       # State reference
```

Only `PASSED` and `FAILED` values are treated as state references.

