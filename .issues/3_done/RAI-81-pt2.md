# RAI-81 — Part 2: Vars resolver loader & argument parser

**Parent ticket:** RAI-81 (RAI-81-feature-vars-resolver.md)

## Scope
Implement the vars-resolver loader and execution utilities: load vars-resolver.js, execute it safely, normalize/validate results, and parse `--resolve-vars` arguments into named/positional structures. This part depends on types from Part 1.

## Files to Modify / Create
- src/variables/varsResolverLoader.ts — new file: exports `loadVarsResolver`, `executeVarsResolver`, `parseResolveVarsArgs`
- __tests__/unit/varsResolverLoader.test.ts — unit tests for parsing, loader behavior, normalization and validation

## Implementation Steps
1. Create src/variables/varsResolverLoader.ts exposing:
   - loadVarsResolver(resolverPath: string | null): VarsResolverFn | null
     - returns null when path is null
     - uses dynamic import or require to load module and return default export
     - on module load error, throw `Failed to load vars-resolver.js: ${err.message}`
   - executeVarsResolver(resolverFn: VarsResolverFn, input: VarsResolverInput): Promise<Record<string,string>>
     - call resolverFn(input)
     - normalize null -> {}
     - validate all values are strings; throw on non-string value with clear message
     - return normalized Record<string,string>
   - parseResolveVarsArgs(rawArgs?: string[]): { namedArgs: Record<string,string>, positionalArgs: string[] }
     - split args on `=` into named; rest are positional
2. Write unit tests (__tests__/unit/varsResolverLoader.test.ts):
   - parseResolveVarsArgs parses named, positional, mixed
   - loadVarsResolver(null) -> null
   - loadVarsResolver(nonexistent) throws with message
   - executeVarsResolver normalizes null to {}
   - executeVarsResolver throws on non-string values

## Acceptance Criteria
- [ ] varsResolverLoader implements loader, executor, and parser
- [ ] loader returns null when path null and throws with clear message on module load errors
- [ ] executeVarsResolver validates string values and normalizes null
- [ ] Unit tests cover parsing and execution behaviors

## Context from Parent
Relevant excerpt from parent ticket (loader plan):

- `loadVarsResolver(resolverPath: string | null): VarsResolverFn | null` — Returns null if path is null; uses require/dynamic import; throws on load errors
- `executeVarsResolver(resolverFn: VarsResolverFn, input: VarsResolverInput): Promise<Record<string,string>>` — normalizes null, validates strings
- `parseResolveVarsArgs(rawArgs?: string[])` — parses named (key=value) and positional args
