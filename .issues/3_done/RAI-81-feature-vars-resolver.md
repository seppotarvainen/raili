# RAI-81: Support vars-resolver.js for pre-run variable fetching with parameters

**Type:** feature

## Description

Add support for a `.raili/<workflow>/vars-resolver.js` file that allows users to programmatically fetch initial variables before a run starts. Users can pass a `--resolve-vars` flag (with optional key=value or positional arguments) to `raili run`, which will invoke the resolver function, merge its output with CLI variables and vars.yaml, and proceed with the run. This enables fetching variables from external systems (APIs, databases, environment-specific config) without manual copy-paste from Jira or configuration management systems. Unlike `raili listen`, the resolver is called once at startup, not in a loop.

## Documentation References

- documentation/variables.md (update "Supplying Values" section to include resolver)

## Code References

- src/types.ts (RailiRunArgs interface)
- src/cli.ts (parseRunArgs function, CLI entry point)
- src/run.ts (runCommand function signature and variable merging logic)
- src/variables/varsLoader.ts (existing loadVarsFile function for pattern reference)
- src/context/pathUtils.ts (resolver path resolution functions)
- src/init.ts (scaffold generation for initialization)

## Implementation Plan

1. **src/types.ts** — Add new interface `VarsResolverInput` and type for vars resolver functions:
   ```typescript
   export interface VarsResolverInput {
     // Named arguments (key=value pairs from CLI)
     namedArgs?: Record<string, string>;
     // Positional arguments (single values from CLI)
     positionalArgs?: string[];
     // Current workflow directory
     workflowDir?: string;
     // Current persisted workflow context (if in continue mode)
     context?: WorkflowContext;
   }
   
   export interface VarsResolverResult {
     [key: string]: string;  // Map of variable name to value
   }
   
   type VarsResolverFn = (input: VarsResolverInput) => 
     Promise<VarsResolverResult | null> | VarsResolverResult | null;
   ```

2. **src/types.ts** — Add optional `resolveVars?: string | string[]` field to `RailiRunArgs` interface to capture resolver arguments from CLI

3. **src/cli.ts** — Update `parseRunArgs()` function to parse `--resolve-vars` flag:
   - Support `--resolve-vars "key1=value1" "key2=value2"` (named args)
   - Support `--resolve-vars "positional_arg"` (positional arg)
   - Support `--resolve-vars` with no args (call resolver with empty input)
   - Return as `resolveVars?: string[]` in `RailiRunArgs` (array of raw argument strings)

4. **src/context/pathUtils.ts** — Add `resolveVarsResolverPath()` function:
   ```typescript
   export function resolveVarsResolverPath(workflowDir: string): string | null {
     const fs = getFileSystem();
     const p = path.join(workflowDir, 'vars-resolver.js');
     if (fs.existsSync(p)) {
       return p;
     }
     return null;
   }
   ```

5. **src/variables/varsResolverLoader.ts** (new file) — Create loader with execution:
   - Function `loadVarsResolver(resolverPath: string | null): VarsResolverFn | null` that:
     - Returns null if path is null (resolver not present, not an error)
     - Uses `require()` or dynamic import to load the JS file
     - Returns the default export (expected to be async function)
     - Catches module load errors and throws with clear message: `"Failed to load vars-resolver.js: ${error.message}"`
   - Function `executeVarsResolver(resolverFn: VarsResolverFn, input: VarsResolverInput): Promise<Record<string, string>>` that:
     - Calls the resolver with the input
     - Normalizes result to always be a Record (null → {})
     - Validates that all result values are strings
     - Throws on non-string values: `"vars-resolver returned non-string value for key '${key}'"`
     - Returns the Record
   - Function `parseResolveVarsArgs(rawArgs?: string[]): { namedArgs: Record<string, string>; positionalArgs: string[] }` that:
     - Parses `--resolve-vars` arguments into named and positional
     - Named: splits on `=` (e.g., `"card_id=12345"` → `{ card_id: "12345" }`)
     - Positional: all non-matching args
     - Throws on invalid format (no validation needed, just structure)

6. **src/run.ts** — Update `runCommand()` function:
   - Add parameter `resolveVarsArgs?: string[]` to function signature
   - After loading fileVars (around line 115) but before initializeContext (for clean mode):
     - Resolve the vars-resolver.js path in the workflow directory
     - Parse resolveVarsArgs into namedArgs and positionalArgs
     - Load and execute the resolver with the parsed input (pass workflowDir, context)
     - Merge resolver output with precedence: **CLI flags > resolver result > fileVars > defaults**
     - In clean mode only: `context = initializeContext({ ...fileVars, ...resolverVars, ...vars, workflow: workflowName })`
     - In continue mode: skip the resolver entirely — vars are already loaded from context.json (consistent with how interactive prompts are skipped on resume)

7. **src/cli.ts** — At the main entry point or where CLI dispatches to `runCommand()`:
   - Extract `resolveVars` from parsed `RailiRunArgs`
   - Pass it as `resolveVarsArgs` parameter to `runCommand()` call

8. **src/init.ts** — Add scaffold generation for vars-resolver template:
   - Generate `.raili/<workflow>/vars-resolver.js` with example:
     ```javascript
     /**
      * Pre-run variable resolver
      * Called before workflow execution starts
      * 
      * @param {Object} input - Resolver input
      * @param {Record<string, string>} input.namedArgs - Named arguments from --resolve-vars key=value
      * @param {string[]} input.positionalArgs - Positional arguments from --resolve-vars value
      * @param {string} input.workflowDir - Absolute path to workflow directory
      * @param {Object} input.context - Current workflow context (in continue mode)
      * @returns {Promise<Object|null>} - Map of variable name to string value, or null
      */
     export default async function resolveVars(input) {
       // Example: fetch from an API using input.namedArgs.card_id
       // return { ticket_id: "PROJ-123", description: "..." };
       return null;  // No variables to add
     }
     ```

## Examples

### Example 1: Using vars-resolver with named arguments

```bash
raili run --clean --resolve-vars "card_id=12345" "env=prod"
```

Resolver is called with:
```javascript
{
  namedArgs: { card_id: "12345", env: "prod" },
  positionalArgs: [],
  workflowDir: "/path/to/.raili/main",
  context: null
}
```

Resolver implementation (in `.raili/main/vars-resolver.js`):
```javascript
export default async function resolveVars(input) {
  // Fetch from Jira API using card_id
  const response = await fetch(`https://jira.example.com/api/v2/issues/${input.namedArgs.card_id}`);
  const issue = await response.json();
  return {
    ticket_id: issue.key,
    description: issue.fields.summary,
    assignee: issue.fields.assignee.name
  };
}
```

After resolution, variables are merged:
- Resolver result: `{ ticket_id: "PROJ-456", description: "Login bug", assignee: "alice" }`
- CLI args: `{ card_id: "12345", env: "prod" }` (used by resolver, not exposed to workflow)
- Final vars available to workflow: `{ ticket_id: "PROJ-456", description: "Login bug", assignee: "alice", card_id: "12345", env: "prod" }`

### Example 2: Using vars-resolver with positional argument

```bash
raili run --clean --resolve-vars "12345"
```

Resolver is called with:
```javascript
{
  namedArgs: {},
  positionalArgs: ["12345"],
  workflowDir: "/path/to/.raili/main",
  context: null
}
```

### Example 3: Using vars-resolver without arguments

```bash
raili run --clean --resolve-vars
```

Resolver is called with:
```javascript
{
  namedArgs: {},
  positionalArgs: [],
  workflowDir: "/path/to/.raili/main",
  context: null
}
```

### Example 4: Merging precedence

```bash
# .raili/main/vars.yaml contains:
# ticket_id: FALLBACK-111
# description: "fallback description"

# Resolver returns:
# { ticket_id: "PROJ-123", assignee: "bob" }

# CLI provides:
# --var ticket_id=OVERRIDE-999

# Final variables:
# { ticket_id: "OVERRIDE-999", description: "fallback description", assignee: "bob" }
```

Precedence (highest to lowest): **CLI flags (--var) > resolver result > vars.yaml > interactive prompt**

### Example 5: Continue mode

When resuming with `--continue`, the resolver is **not called**. Variables are already loaded from `context.json`, the same way interactive prompts are skipped on resume. Passing `--resolve-vars` in continue mode is silently ignored.

### Expected behavior / output

1. When `raili run --resolve-vars` is called and a `vars-resolver.js` exists in the workflow:
   - Resolver is loaded and executed with the parsed arguments
   - Resolver output is merged with other variable sources
   - Execution proceeds with merged variables
   - If resolver returns null or throws, the run fails with clear error message

2. CLI output (example):
   ```
   Resolving variables from vars-resolver.js...
   Resolver returned: { ticket_id: "PROJ-123", description: "Bug fix" }
   Merged variables: { ticket_id: "PROJ-123", description: "Bug fix", branch: "main" }
   Running workflow starting from state 'analyze'...
   ```

3. If resolver throws or returns invalid data:
   ```
   Error: vars-resolver.js failed: Cannot fetch from API (network error)
   Run failed.
   ```

4. If `--resolve-vars` is provided but `vars-resolver.js` doesn't exist:
   ```
   Error: --resolve-vars flag provided but vars-resolver.js not found in .raili/<workflow>/
   ```

## Test Plan

### Unit tests (`__tests__/unit/varsResolverLoader.test.ts`)

- **Test case:** "parseResolveVarsArgs parses named arguments"
  - Setup: `rawArgs = ["card_id=12345", "env=prod"]`
  - Act: `const { namedArgs, positionalArgs } = parseResolveVarsArgs(rawArgs)`
  - Assert: `namedArgs === { card_id: "12345", env: "prod" } && positionalArgs.length === 0`

- **Test case:** "parseResolveVarsArgs parses positional arguments"
  - Setup: `rawArgs = ["12345", "prod"]`
  - Act: `const { namedArgs, positionalArgs } = parseResolveVarsArgs(rawArgs)`
  - Assert: `Object.keys(namedArgs).length === 0 && positionalArgs === ["12345", "prod"]`

- **Test case:** "parseResolveVarsArgs handles mixed arguments"
  - Setup: `rawArgs = ["card_id=12345", "positional_val"]`
  - Act: `const { namedArgs, positionalArgs } = parseResolveVarsArgs(rawArgs)`
  - Assert: `namedArgs.card_id === "12345" && positionalArgs === ["positional_val"]`

- **Test case:** "loadVarsResolver returns null when path is null"
  - Setup: `resolverPath = null`
  - Act: `const fn = loadVarsResolver(null)`
  - Assert: `fn === null`

- **Test case:** "loadVarsResolver throws on missing file"
  - Setup: `resolverPath = "/nonexistent/vars-resolver.js"`
  - Act: `loadVarsResolver(resolverPath)` (should throw)
  - Assert: `error.message includes "Failed to load vars-resolver.js"`

- **Test case:** "executeVarsResolver normalizes null result to empty object"
  - Setup: Mock resolver function returning null, `input = { namedArgs: {}, positionalArgs: [] }`
  - Act: `const result = await executeVarsResolver(mockResolver, input)`
  - Assert: `result === {}`

- **Test case:** "executeVarsResolver validates all values are strings"
  - Setup: Mock resolver returning `{ key1: "value", key2: 123 }`
  - Act: `await executeVarsResolver(mockResolver, input)` (should throw)
  - Assert: `error.message includes "non-string value for key 'key2'"`

### Unit tests for CLI parsing (`__tests__/unit/cli.test.ts`)

- **Test case:** "parseRunArgs parses --resolve-vars with named arguments"
  - Setup: `argv = ["run", "--clean", "--resolve-vars", "card_id=12345", "env=prod"]`
  - Act: `const args = parseRunArgs(argv)`
  - Assert: `args.resolveVars === ["card_id=12345", "env=prod"]`

- **Test case:** "parseRunArgs parses --resolve-vars with no arguments"
  - Setup: `argv = ["run", "--clean", "--resolve-vars"]`
  - Act: `const args = parseRunArgs(argv)`
  - Assert: `args.resolveVars === []`

- **Test case:** "parseRunArgs omits resolveVars field when flag not provided"
  - Setup: `argv = ["run", "--clean"]`
  - Act: `const args = parseRunArgs(argv)`
  - Assert: `args.resolveVars === undefined`

### Integration tests (`__tests__/integration/vars-resolver.integration.test.ts`)

**Setup patterns from testUtils.ts:**
- Use `createTmpWorkspace()` to create a sandboxed temp directory
- Use `writeWorkflow()` to write `.raili/main/workflow.yaml`
- Use `writeAgentRegistry()` and `writeScriptRegistry()` to set up registries
- Create `vars-resolver.js` directly using `fs.writeFileSync()` in `.raili/main/` directory
- Mock `child_process` to avoid real copilot CLI calls
- Use `cleanupRailiEnvVars()` in `afterEach()`
- Use `loadContext()` to assert final state

- **Test case:** "vars-resolver returns variables that are merged into context"
  ```typescript
  // Create vars-resolver.js that returns { ticket_id: "PROJ-123", description: "Test" }
  // Write workflow with inputs: [ticket_id, description]
  // Run with: raili run --clean --resolve-vars "card_id=12345"
  // Assert: context.vars contains { ticket_id: "PROJ-123", description: "Test" }
  // Assert: runCommand was called (via mock)
  ```

- **Test case:** "vars-resolver receives namedArgs and positionalArgs"
  ```typescript
  // Create vars-resolver.js that validates input contains namedArgs/positionalArgs
  // Write workflow with inputs: [param1]
  // Run with: raili run --clean --resolve-vars "key=value" "positional"
  // Assert: resolver was called (can check via console output or side effects)
  ```

- **Test case:** "CLI vars override resolver result"
  ```typescript
  // Resolver returns { ticket_id: "FROM_RESOLVER" }
  // CLI provides --var ticket_id=FROM_CLI
  // Assert: context.vars.ticket_id === "FROM_CLI"
  ```

- **Test case:** "Resolver result overrides vars.yaml"
  ```typescript
  // Write vars.yaml with { ticket_id: "FROM_FILE", description: "file" }
  // Resolver returns { ticket_id: "FROM_RESOLVER" }
  // Assert: context.vars.ticket_id === "FROM_RESOLVER"
  // Assert: context.vars.description === "file" (from file, not overridden)
  ```

- **Test case:** "vars-resolver throws error when resolver file fails"
  ```typescript
  // Create vars-resolver.js that throws: throw new Error("API failed")
  // Run with: raili run --clean --resolve-vars
  // Assert: runCommand throws with message containing "vars-resolver"
  ```

- **Test case:** "No error when --resolve-vars flag provided but vars-resolver.js missing"
  ```typescript
  // Don't create vars-resolver.js
  // Run with: raili run --clean --resolve-vars "card_id=123"
  // Assert: runCommand throws with error message about missing file
  ```

- **Test case:** "Resolver output null is treated as empty result"
  ```typescript
  // Create vars-resolver.js that returns null
  // Write workflow with inputs: [ticket_id]
  // Also provide --var ticket_id=CLI_VALUE
  // Run with: raili run --clean --resolve-vars
  // Assert: context.vars.ticket_id === "CLI_VALUE" (resolver null doesn't block other sources)
  ```

## Acceptance Criteria

- [ ] `parseRunArgs()` correctly parses `--resolve-vars` flag with zero, one, or multiple arguments
- [ ] `RailiRunArgs` interface includes optional `resolveVars?: string[]` field
- [ ] `vars-resolver.js` is loaded from `.raili/<workflow>/` directory when resolver flag is provided
- [ ] Resolver function receives input with `namedArgs`, `positionalArgs`, `workflowDir`, and `context`
- [ ] Resolver output is merged with precedence: **CLI flags > resolver > vars.yaml > prompt**
- [ ] Resolver result values are validated to be strings; non-strings cause run to fail
- [ ] Resolver null result is normalized to empty object (does not block execution)
- [ ] Resolver errors are caught and displayed with clear error message naming vars-resolver.js
 - [ ] In continue mode, resolver is skipped (vars already in context.json; same behaviour as interactive prompt skipping)
- [ ] CLI returns clear error if `--resolve-vars` provided but `vars-resolver.js` doesn't exist
- [ ] `.raili/main/vars-resolver.js` template is generated during `raili init`
- [ ] All unit tests pass (CLI parsing, resolver parsing, execution)
- [ ] All integration tests pass (end-to-end resolver execution, variable merging, error handling)
- [ ] No breaking changes to existing `raili run` behavior (feature is purely additive)
