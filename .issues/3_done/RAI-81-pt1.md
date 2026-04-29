# RAI-81 — Part 1: Types & CLI parsing for --resolve-vars

**Parent ticket:** RAI-81 (RAI-81-feature-vars-resolver.md)

## Scope
Add the shared types for vars-resolver and extend the CLI to accept a --resolve-vars flag. This foundational part enables the later loader and runtime integration.

## Files to Modify
- src/types.ts — add VarsResolverInput, VarsResolverResult, VarsResolverFn types and add resolveVars?: string[] to RailiRunArgs
- src/cli.ts — parseRunArgs(): parse `--resolve-vars` into resolveVars?: string[] and surface it in RailiRunArgs
- __tests__/unit/cli.test.ts — add unit tests for parseRunArgs behavior

## Implementation Steps
1. In src/types.ts add:
   - VarsResolverInput (namedArgs, positionalArgs, workflowDir, context)
   - VarsResolverResult = Record<string,string>
   - VarsResolverFn type (accepts VarsResolverInput and returns Promise<VarsResolverResult|null> | VarsResolverResult | null
   - Add optional `resolveVars?: string[]` to RailiRunArgs
2. In src/cli.ts update parseRunArgs() to:
   - Accept `--resolve-vars` flag with zero or more values
   - Return raw values as `resolveVars?: string[]` (empty array if flag present without args)
   - Ensure existing parsing behavior unchanged when flag absent
3. Add unit tests in __tests__/unit/cli.test.ts for:
   - Named args array parsed and returned
   - No-arg flag returns []
   - Flag absent results in undefined

## Acceptance Criteria
- [ ] `RailiRunArgs` includes optional `resolveVars?: string[]`
- [ ] parseRunArgs correctly parses `--resolve-vars` with zero, one, or multiple arguments
- [ ] Unit tests verifying parsing are added and pass

## Context from Parent
Relevant excerpt from parent ticket:

```ts
export interface VarsResolverInput {
  namedArgs?: Record<string, string>;
  positionalArgs?: string[];
  workflowDir?: string;
  context?: WorkflowContext;
}

export interface VarsResolverResult {
  [key: string]: string;
}

type VarsResolverFn = (input: VarsResolverInput) =>
  Promise<VarsResolverResult | null> | VarsResolverResult | null;
```

And CLI requirements:
- Support `--resolve-vars "key=val" "positional"`
- Support `--resolve-vars` with no args (call resolver with empty input)
- Return raw args as resolveVars?: string[] in RailiRunArgs
