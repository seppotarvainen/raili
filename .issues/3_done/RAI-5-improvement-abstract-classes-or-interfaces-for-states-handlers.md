# RAI-5: Explore abstract classes or interfaces for State and handlers

**Type:** improvement

## Description
Explore using TypeScript abstract classes or interfaces (or composition) to consolidate shared logic between State implementations and their handlers. The goal is to reduce duplication, improve maintainability, and make it easier to add new state/handler types without repeating plumbing. If abstraction is not appropriate, evaluate composition and document the recommended approach with migration steps that preserve existing behavior and tests.

## Documentation References
- documentation/workflow-yaml.md
- documentation/raili-mvp.md
- docs/states.md
- docs/routing.md

## Code References
- src/engine/AgentStateRunner.ts (AgentStateRunner)
- src/engine/ApproveStateRunner.ts (ApproveStateRunner)
- src/engine/CommandStateRunner.ts (CommandStateRunner)
- src/engine/ScriptStateRunner.ts (ScriptStateRunner)
- src/engine/Engine.ts (Engine)
- src/handlers/agentHandler.ts (executeAgent)
- src/handlers/scriptHandler.ts (executeScript)
- src/handlers/commandHandler.ts (executeCommand)
- src/handlers/manualHandler.ts (manual approval flow)
- src/handlers/notifyHandler.ts (notify pre-state hook)
- src/registryValidator.ts (registry validation logic)
- src/workflowLoader.ts (workflow -> state DAG builder)
- src/types.ts (State type definitions)
- src/transition.ts (routing/transition resolution)
- src/outputStore.ts (output storing/filtering)

## Acceptance Criteria
- [x] Produce a short design doc (<project_root>.issues/plans/state-handler-abstractions.md) describing 2–3 options: abstract classes, interfaces with concrete helpers, and composition. Include pros/cons, TypeScript code sketches, and migration steps.
- [x] Identify all places where shared logic can be centralized; list exact lines or functions to change in the files listed above (see design doc and comment blocks in types/engine files).
- [x] Provide a small prototype refactor that implements the chosen pattern for one state runner and its handler (AgentStateRunner + agentHandler) with no behavioral changes. Prototype implemented in src/engine/AgentStateRunner.ts and src/handlers/agentHandler.ts.
- [x] Add or update unit tests under __tests__/unit that mock external side effects to verify behavior is unchanged (transition routing, max_visits enforcement, notify/reset_outputs semantics). All unit tests must pass (npm test).
- [x] Integration tests (if present under __tests__/integration) remain unchanged and continue to pass without modification.
- [x] Update ScriptStateRunner and scriptHandler (look reference from agent runner/handler)
- [x] Update CommandStateRunner and commandHandler (look reference from agent runner/handler)
