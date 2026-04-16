# Raili LSP Setup

## Installation

1. Update Raili to latest version:
```bash
npm install -g raili
```

2. Install LSP4IJ plugin in IntelliJ:
   - Settings → Plugins
   - Search "LSP4IJ"
   - Install and restart IDE

3. Configure LSP server:
   - Settings → Languages & Frameworks → LSP Support
   - Click + to add server
   - Name: `Raili`
   - Server type: `Executable`
   - Command: `raili-lsp --stdio`
   - File type: `YAML`
   - Pattern: `workflow.yaml`
   - Click OK, Apply, Restart IDE

4. Open any `workflow.yaml` file to test features.

## Features

- **Hover** - Move mouse over state name to see metadata
- **Goto Definition** - Cmd+Click on state names (macOS)
- **Find References** - Right-click state → Find Usages
- **Rename** - Shift+F6 to rename state and update all references
- **Diagnostics** - Real-time validation errors with red squiggles

## What LSP Validates

- Undefined state references in routing contexts
- State names in `on:`, `transitions:`, `approval:`, `skip:`, `continue:`
- Approval blocks: only `PASSED` and `FAILED` are state references
- Other approval properties (`multiline`, `notify`, `question`, `feedback:` blocks) are ignored
- Boolean values (`true`, `false`) and shell commands are not treated as state references

## Troubleshooting

### Binary not found: "raili-lsp: command not found"

Launch IDE from terminal to inherit shell PATH:
```bash
open /Applications/IntelliJ\ IDEA.app  # macOS
# Or on Linux:
~/idea-IC-xxx/bin/idea.sh &
```

Or set IDE PATH variable:
1. Settings → Appearance & Behavior → Path Variables
2. Add new variable: `NODE_BIN` = output of `npm config get prefix`/bin
3. Use in LSP command: `$NODE_BIN/raili-lsp --stdio`
4. Restart IDE

### No diagnostics appear

1. Verify file is named exactly `workflow.yaml` (case-sensitive)
2. Check file has valid YAML syntax
3. Restart IDE completely (close IDE, reopen)
4. View → Tool Windows → Language Server Protocol (check for errors)

### Hover doesn't work

- Hover directly on state name (not whitespace)
- Ensure state is defined in `states:` section
- Check YAML indentation is consistent
- Recent fix: hover now returns proper LSP Hover object with formatted markdown
- Make sure your LSP4IJ is up to date

### Goto definition not working

- Click on state reference in routing context, not the definition itself
- State must be defined in workflow
- Example: Click `done` in `on: {PASSED: done}`, not the `done:` line
- Recent fix: goto definition now returns proper LSP Location object with correct line/column
- Make sure your LSP4IJ is up to date

### Error at wrong line

Update to latest version:
```bash
npm install -g raili
```

Latest fixes diagnostic positioning.

## Limitations (v1)

- Single-file scope (no cross-file navigation for groups/embeds)
- No variable interpolation validation
- No code completion
- Performance: good for <500 states

Cross-file support planned for v2.

