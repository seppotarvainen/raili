# RAI-2: Default transition is not respected

**Type:** bug

## Description
The engine fails to route to a state's `transitions.default` target when a state's outcome does not match any explicit transition key. For the provided workflow, the command state returns `complete` but the runner throws an error instead of using `default: done`. This breaks workflows that rely on a catch-all `default` mapping.

## Documentation References
- documentation/routing.md
- documentation/states.md

## Code References
- src/engine/Engine.ts (resolveNextState, Engine.run)
- src/engine/CommandStateRunner.ts (runCommandState)
- src/handlers/commandHandler.ts (executeCommand)
- src/transition.ts (resolveTransition)

## Acceptance Criteria
- [x] runCommandState no longer throws when the command's last stdout line is not an explicit transitions key and `default` is present; it uses the `default` mapping instead.
- [x] Engine routing behavior remains unchanged when `default` is absent (still fails fast and throws the existing error).
- [x] Unit tests added covering: command state with unexpected outcome using `default`, command state without `default` throwing, and engine-level resolveNextState behavior.
- [x] documentation/routing.md and documentation/states.md include a short example and note describing `transitions: default: <state>` semantics.
- [ ] All tests pass (`npm test`).

## Related
- .issues/3_done/RAI-1-improvement-transitions-default-transition.md
