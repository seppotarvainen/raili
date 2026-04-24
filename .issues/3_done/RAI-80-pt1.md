# RAI-80 — Part 1: VisitTracker & shared infra

**Parent ticket:** RAI-80 (RAI-80-chore-refactor-runner-monolith.md)

## Scope
This part extracts the visit/step tracking responsibilities into a single VisitTracker class and adds unit tests. It provides the minimal shared infrastructure other manager parts depend on (pure logic, no external side effects).

## Files to Modify
- src/runner/visitTracker.ts — add VisitTracker implementation
- __tests__/unit/runner/visitTracker.test.ts — unit tests for VisitTracker

## Implementation Steps
1. Add src/runner/visitTracker.ts implementing VisitTracker with methods:
   - incrementVisit(stateId: string): number
   - getVisitCount(stateId: string): number
   - recordStep(stateId: string): boolean
   - resetVisits(stateIds: string[]): void
   - hasReachedLimit(nextSteps: number): boolean
2. Keep implementation pure; export a typed class for easy mocking.
3. Add unit tests in __tests__/unit/runner/visitTracker.test.ts covering increments, reset, step counting and hasReachedLimit behavior.
4. Ensure tests import VisitTracker directly; no other modules required.

## Acceptance Criteria
- [ ] VisitTracker class file exists and compiles
- [ ] Unit tests cover increment, reset, recordStep, hasReachedLimit
- [ ] Tests pass in CI (pure logic, no external mocks required)

## Context from Parent
From parent ticket (relevant excerpts):

- "Phase 1: Extract Visit Tracking"
  - Move visitCounts, stepsExecuted and countedStates into VisitTracker
  - Extract methods: incrementVisit, getVisitCount, recordStep, resetVisits, hasReachedLimit

This part is foundational and should be implemented first so other manager modules can depend on VisitTracker.