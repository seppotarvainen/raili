# RAI-64: Add `raili create` command that creates a workflow

**Type:** feature

## Description

Currently, users must manually create workflow directories and understand the required file structure (workflow.yaml, vars.yaml, outputs/, learnings/). This adds friction to workflow creation. We'll add a `raili create -w <workflowname>` command that creates a new named workflow with the same templated structure that `raili init` creates for the `main` workflow. The command will fail fast if the workflow already exists, maintaining consistency with Raili's deterministic architecture.

## Documentation References
- documentation/usage/quickstart.md (update to mention new command)
- documentation/usage/commands.md (if exists)

## Code References
- src/cli.ts (RailiCommand entry point, main dispatch)
- src/cli/railiCommand.ts (RailiCommand class, add `create` property)
- src/init.ts (helper functions for template generation — refactor)
- src/cli/help.ts (add help text for create command)
- src/infrastructure/fileSystemProvider.ts (file operations)
- src/types.ts (existing types, may need CreateArgs or similar)

## Implementation Plan

1. **src/cli/railiCommand.ts** — Add `create: boolean` property to `RailiCommand` class. Set it to true when value is 'create'.

2. **src/cli.ts** — Add `parseCreateArgs()` function that parses `-w <workflowname>` flag. Return a type like `{ workflow: string }` or throw if `-w` is missing.

3. **src/init.ts** — Extract template generation logic (workflow.yaml content, agent-registry.json, script-registry.json) into standalone, reusable helper functions:
   - `generateWorkflowYaml(): string` — Returns the template workflow.yaml content
   - `generateAgentRegistry(): object` — Returns the default agent registry
   - `generateScriptRegistry(): object` — Returns the default script registry

4. **src/cli/create.ts** (new file) — Create `createCommand(cwd: string, workflowName: string)` function that:
   - Validates workflow name (no empty strings, no path separators like `/` or `\`)
   - Checks if `.raili/<workflowName>` already exists → throw error if true (fail-fast)
   - Creates `.raili/<workflowName>/` directory
   - Creates `.raili/<workflowName>/outputs/` and `.raili/<workflowName>/learnings/` subdirectories
   - Writes `workflow.yaml` using helper from step 3
   - Writes `vars.yaml` (empty template)
   - Returns success object: `{ created: true, workflowName: string }`

5. **src/cli.ts** (main dispatcher) — Add branch in `main()`:
   - Check `command.create`
   - Call `parseCreateArgs(runArgs)` to extract `-w <workflowname>`
   - Call `createCommand(process.cwd(), workflowName)` from step 4
   - Exit on success (exit code 0)

6. **src/cli/help.ts** — Add entry to `COMMAND_HELP` object:
   - Key: `'create'`
   - Value: `'Usage: raili create -w <workflowname>\n\nCreate a new workflow directory with template files.'`

## Examples

### Command usage
```bash
raili create -w analysis-workflow
# Output: ✓ Created workflow 'analysis-workflow' at .raili/analysis-workflow/
```

### Directory structure created
```
.raili/
  analysis-workflow/
    workflow.yaml          # Same template as .raili/main/workflow.yaml
    vars.yaml              # Empty template (# vars for analysis-workflow workflow)
    outputs/               # Directory for stored state outputs
    learnings/             # Directory for agent learnings
```

### Error case: workflow already exists
```bash
# If .raili/analysis-workflow/ already exists:
raili create -w analysis-workflow
# Output: Error: Workflow 'analysis-workflow' already exists at .raili/analysis-workflow/
# Exit code: 1
```

### Error case: invalid workflow name
```bash
raili create -w "invalid/name"
# Output: Error: Invalid workflow name 'invalid/name'. Workflow names cannot contain path separators.
# Exit code: 1
```

### Error case: missing -w flag
```bash
raili create
# Output: Error: -w <workflowname> is required. Usage: raili create -w <workflowname>
# Exit code: 2
```

## Test Plan

### Unit tests (`__tests__/unit/`)

**File:** `__tests__/unit/create.test.ts`

**Test case:** "creates a new workflow directory with template files"
- Setup: Create a temporary directory, mock filesystem
- Act: Call `createCommand(tmpdir, 'test-workflow')`
- Assert: 
  - `.raili/test-workflow/workflow.yaml` exists
  - `.raili/test-workflow/vars.yaml` exists
  - `.raili/test-workflow/outputs/` directory exists
  - `.raili/test-workflow/learnings/` directory exists
  - workflow.yaml contains expected template content (starts with `# Raili Workflow Configuration`)
  - vars.yaml contains expected header

**Test case:** "fails if workflow already exists"
- Setup: Create tmpdir, create `.raili/test-workflow/` directory
- Act: Call `createCommand(tmpdir, 'test-workflow')`
- Assert: Throws error with message containing `'test-workflow' already exists`

**Test case:** "rejects invalid workflow names with path separators"
- Setup: Create tmpdir
- Act: Call `createCommand(tmpdir, 'invalid/name')`
- Assert: Throws error with message containing `cannot contain path separators`

**Test case:** "rejects empty workflow name"
- Setup: Create tmpdir
- Act: Call `createCommand(tmpdir, '')`
- Assert: Throws error with message containing `empty`

**Test case:** "parseCreateArgs extracts -w flag correctly"
- Setup: args = `['-w', 'my-workflow']`
- Act: Call `parseCreateArgs(args)`
- Assert: Returns `{ workflow: 'my-workflow' }`

**Test case:** "parseCreateArgs throws when -w is missing"
- Setup: args = `[]` or `['--other-flag']`
- Act: Call `parseCreateArgs(args)`
- Assert: Throws error with message containing `-w is required`

**Test case:** "parseCreateArgs throws when -w has no value"
- Setup: args = `['-w']` (flag with no argument)
- Act: Call `parseCreateArgs(args)`
- Assert: Throws error with message containing `-w requires a value`

### Integration tests (`__tests__/integration/`)

**File:** `__tests__/integration/create.test.ts`

**Test case:** "raili create -w creates workflow and workflow is usable"
```typescript
// Sketch showing the key parts:
const tmp = createTmpWorkspace();
writeAgentRegistry(tmp, { 'analyzer': { path: './agents/analyzer.md' } });
writeScriptRegistry(tmp, {});

// Simulate: raili create -w test-wf
await createCommand(tmp, 'test-wf');

// Verify workflow was created
const testWfPath = path.join(tmp, '.raili', 'test-wf');
expect(fs.existsSync(testWfPath)).toBe(true);
expect(fs.existsSync(path.join(testWfPath, 'workflow.yaml'))).toBe(true);
expect(fs.existsSync(path.join(testWfPath, 'vars.yaml'))).toBe(true);
expect(fs.existsSync(path.join(testWfPath, 'outputs'))).toBe(true);
expect(fs.existsSync(path.join(testWfPath, 'learnings'))).toBe(true);

// Verify the created workflow can be loaded and is valid
const config = loadWorkflowConfig(tmp, 'test-wf');
expect(config.initial).toBe('init');
expect(config.states).toBeDefined();
```

**Test case:** "raili create fails if workflow exists"
```typescript
// Sketch:
const tmp = createTmpWorkspace();
writeNamedWorkflow(tmp, 'dup-wf', 'initial: start\nstates:\n  start:\n    type: engine');

// Try to create same workflow
await expect(createCommand(tmp, 'dup-wf')).rejects.toThrow("already exists");
```

## Acceptance Criteria

- [ ] `raili create -w <workflowname>` command is recognized and dispatched from `main()` in cli.ts
- [ ] Command creates `.raili/<workflowname>/` directory with required subdirectories (outputs/, learnings/)
- [ ] Command creates `workflow.yaml` with same template content as `raili init` creates for main workflow
- [ ] Command creates `vars.yaml` with comment header `# vars for <workflowname> workflow`
- [ ] Command fails fast with clear error if `.raili/<workflowname>/` already exists
- [ ] Command fails fast if workflow name contains path separators (`/`, `\`) or is empty
- [ ] Command fails fast with clear error if `-w` flag is missing or has no value
- [ ] Help text `raili create --help` displays correct usage and description
- [ ] Unit tests cover all happy path and error cases (6+ test cases)
- [ ] Integration test verifies created workflow loads correctly and is immediately usable
- [ ] Template helper functions (generateWorkflowYaml, generateAgentRegistry, generateScriptRegistry) are reusable and tested
- [ ] Exit codes: 0 for success, 1 for expected errors (already exists, invalid name), 2 for usage errors (missing flag)
