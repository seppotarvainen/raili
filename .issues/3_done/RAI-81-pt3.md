# RAI-81 — Part 3: Integrate resolver into run/init/docs + integration tests

**Parent ticket:** RAI-81 (RAI-81-feature-vars-resolver.md)

## Scope
Wire the vars-resolver into runtime: detect vars-resolver.js, parse resolve vars args, execute loader, merge results with proper precedence, add init scaffold template, update docs, and add integration tests validating end-to-end behavior.

## Files to Modify
- src/run.ts — call resolver before initializing context, merge resolver output with precedence (CLI > resolver > vars.yaml > defaults)
- src/context/pathUtils.ts — add resolveVarsResolverPath(workflowDir: string): string | null
- src/init.ts — generate `.raili/<workflow>/vars-resolver.js` template during `raili init`
- documentation/variables.md — update "Supplying Values" to mention resolver and precedence
- __tests__/integration/vars-resolver.integration.test.ts — integration tests as in parent ticket

## Implementation Steps
1. Add resolveVarsResolverPath to src/context/pathUtils.ts to detect `.raili/<workflow>/vars-resolver.js` (return null if missing).
2. In src/run.ts (runCommand signature receives resolveVarsArgs?: string[]):
   - After loading fileVars and before initializeContext (clean mode), call parseResolveVarsArgs(rawArgs) to obtain named/positional
   - Resolve resolverPath using resolveVarsResolverPath(workflowDir)
   - If resolveVarsArgs provided but resolverPath missing, throw error about missing file
   - Load resolver with loadVarsResolver(resolverPath) (from Part 2) and execute with VarsResolverInput
   - Merge variables with precedence: CLI flags (--var) > resolverResult > vars.yaml > defaults
   - On resolver errors, surface clear error message and abort run
   - Resolver is ONLY called in clean mode. In continue mode, vars are already loaded from context.json — skip resolver entirely (consistent with how interactive prompts are skipped on resume)
3. Update src/init.ts to create `.raili/<workflow>/vars-resolver.js` template (example from parent ticket) when scaffolding
4. Update documentation/variables.md supplying examples and precedence note
5. Add integration tests under __tests__/integration/ as specified in parent ticket (create vars-resolver.js, run with `--resolve-vars`, assert merged context, error handling, CLI overrides)

## Acceptance Criteria
- [ ] runCommand accepts resolveVarsArgs and merges resolver output with correct precedence (clean mode only)
- [ ] If `--resolve-vars` provided but resolver file missing, run fails with clear error
- [ ] Resolver is skipped entirely in continue mode (vars already in context.json)
- [ ] init generates vars-resolver.js template
- [ ] Documentation updated to describe resolver usage and precedence
- [ ] Integration tests cover success, CLI override, missing file error, null result behavior

## Context from Parent
Key runtime & examples:

- Merge precedence (highest to lowest): CLI flags (--var) > resolver result > vars.yaml > interactive prompt

Example resolver template to generate in init:

```javascript
export default async function resolveVars(input) {
  // Example: fetch from an API using input.namedArgs.card_id
  // return { ticket_id: "PROJ-123", description: "..." };
  return null;  // No variables to add
}
```

Expected CLI messages:
```
Resolving variables from vars-resolver.js...
Resolver returned: { ticket_id: "PROJ-123", description: "Bug fix" }
Merged variables: { ticket_id: "PROJ-123", description: "Bug fix", branch: "main" }
Running workflow starting from state 'analyze'...
```
