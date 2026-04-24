# RAI-80 — Part 3: StateExecutionManager & RoutingManager

**Parent ticket:** RAI-80 (RAI-80-chore-refactor-runner-monolith.md)

## Scope
Extract execution dispatch (agent/script/command) and export processing into StateExecutionManager, and consolidate routing (skip evaluation, normal routing, error routing) into RoutingManager. These modules focus on deterministic state outcome processing.

## Files to Modify
- src/runner/stateExecutionManager.ts — new class StateExecutionManager
- src/runner/routingManager.ts — new class RoutingManager
- __tests__/unit/runner/stateExecutionManager.test.ts — unit tests
- __tests__/unit/runner/routingManager.test.ts — unit tests

## Implementation Steps
1. Implement StateExecutionManager exposing:
   - constructor(deps: { agentStateRunner, scriptStateRunner, commandStateRunner, contextApi, variableExportParser })
   - async executeAndExport(stateId: string, stateDef: StateDef, context: WorkflowContext): Promise<StateResult>
   - Handle running the correct runner by state type, collect stdout/stderr, determine outcome, and parse/export variables into context.
2. Implement RoutingManager exposing:
   - evaluateSkip(stateId, stateDef, stateMachine): string | null
   - routeToNext(stateId, stateDef, outcome, stateMachine, presenter?): string
   - async routeError(err, stateMachine, context, cwd, workflowArg?): Promise<boolean>
   - Enforce illegal outcome checking and fail-fast behavior
3. Add unit tests mocking runners, transition resolution, and context API:
   - stateExecutionManager.test.ts: ensure correct runner dispatched and exports merged
   - routingManager.test.ts: skip evaluation, valid outcome routing, illegal outcome throws, error routing returns true/false depending on stateMachine.error
4. Keep responsibilities isolated: execution+export vs routing decisions. Both should be usable by Runner orchestration in Part 4.

## Acceptance Criteria
- [ ] StateExecutionManager implemented and unit-tested
- [ ] RoutingManager implemented and unit-tested
- [ ] Illegal outcome handling throws meaningful error
- [ ] Skip evaluation and error routing behave as described in the parent ticket

## Context from Parent
From parent ticket (relevant excerpts):

- "Phase 3: Extract Execution & Export Processing"
  - Move executeState() and state runner dispatch logic
  - Move handleExports() functionality here

- "Phase 6: Consolidate Routing & Error Recovery"
  - Combine normal routing, skip logic, and error recovery routing into RoutingManager
  - Public methods: evaluateSkip, routeToNext, routeError

These modules should keep the engine deterministic and fail-fast as before.