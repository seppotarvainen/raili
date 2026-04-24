# RAI-80 — Part 4: InteractiveFlowManager, TeachManager & Runner Orchestration

**Parent ticket:** RAI-80 (RAI-80-chore-refactor-runner-monolith.md)

## Scope
Extract interactive flows (approval & feedback) into InteractiveFlowManager, teaching logic into TeachManager, and refactor Runner to orchestrate all managers created in previous parts. This is the integration step that wires modules together and updates Runner.run() to be a thin orchestrator.

## Files to Modify
- src/runner/interactiveFlowManager.ts — new class InteractiveFlowManager
- src/runner/teachManager.ts — new class TeachManager
- src/runner/runner.ts — refactor to orchestrate managers (replace monolith with orchestration only)
- __tests__/unit/runner/interactiveFlowManager.test.ts — unit tests
- __tests__/unit/runner/teachManager.test.ts — unit tests
- __tests__/unit/runner/runner.test.ts — update existing tests to mock managers and assert orchestration

## Implementation Steps
1. Implement InteractiveFlowManager exposing:
   - async handleApproval(stateId, stateDef, presenter?): Promise<string>
   - async handleFeedback(stateId, stateDef, context, presenter?): Promise<string | null>
   - Use existing approveStateRunner and manualHandler behavior but encapsulate decision, exposure, persistence
2. Implement TeachManager exposing:
   - async teach(stateId, stateDef, context): Promise<void>
   - Use learningStore and outputStore; validate referenced outputs and variables; fail-fast on missing data
3. Refactor src/runner/runner.ts:
   - Keep Runner class signature and public run(): Promise<void>
   - Instantiate managers (VisitTracker, StateEntryManager, StateExecutionManager, InteractiveFlowManager, TeachManager, RoutingManager)
   - Implement orchestration loop: evaluateSkip → enter → executeAndExport → approval → feedback → teach → routeToNext
   - On errors, call routingManager.routeError and rethrow if not handled
4. Update __tests__/unit/runner/runner.test.ts to mock managers and assert orchestration flow (no behavior change expected from outside)
5. Run unit tests and integration tests to ensure no regressions.

## Acceptance Criteria
- [x] InteractiveFlowManager and TeachManager implemented and unit-tested
- [x] Runner refactored to orchestrate managers; Runner.run() behavior unchanged externally
- [x] Existing runner unit tests updated and passing (mocks adjusted)
- [x] Integration tests pass without modification
- [x] Presenter instantiation remains only inside Runner

## Context from Parent
From parent ticket (relevant excerpts):

- "Phase 4: Extract Interactive Flows (Approval & Feedback)"
- "Phase 5: Extract Teaching Logic"
- "Phase 7: Refactor Runner Class"
  - Runner should instantiate managers and orchestrate phases
  - Keep Presenter instantiation in Runner

This part wires earlier parts into a coherent, testable Runner architecture. It is the final integration step and should be landed after Parts 1–3.