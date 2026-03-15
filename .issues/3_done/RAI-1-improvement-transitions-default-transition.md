# RAI-1: Type 'transitions' should have default transition

**Type:** improvement

## Description
When a state uses `transitions:` to map named outcomes to next states, add support for a reserved `default` transition key that will be used when the state's outcome does not match any explicit mapping. This prevents workflows from failing on unexpected outcome values and provides a clear catch-all route while preserving fail-fast behavior when no default is provided.

## Documentation References
- documentation/routing.md
- documentation/states.md

## Code References
- src/engine/Engine.ts (resolveNextState, Engine.run)

## Acceptance Criteria
- [x] Engine routing logic accepts a `default` key inside `transitions:` and selects it when the reported outcome is not present in the explicit mapping.
- [x] Existing behavior unchanged when `default` is not defined: missing outcome still throws the existing error.
- [x] Unit tests added covering: agent state with unexpected outcome (uses `default`), script/command state with unexpected outcome (uses `default`), and behavior when `default` absent (throws error).
- [x] Documentation updated: documentation/routing.md and documentation/states.md include a short note and example showing `transitions: default: <state>` behavior.
- [ ] All existing tests continue to pass (run `npm test`).

