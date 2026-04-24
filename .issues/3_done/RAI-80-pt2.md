# RAI-80 — Part 2: StateEntryManager

**Parent ticket:** RAI-80 (RAI-80-chore-refactor-runner-monolith.md)

## Scope
Extract state entry responsibilities (max_visits enforcement, reset_outputs, history recording, notify, presenter creation, approval variable initialization) into StateEntryManager. Depends on VisitTracker from Part 1.

## Files to Modify
- src/runner/stateEntryManager.ts — new class StateEntryManager
- __tests__/unit/runner/stateEntryManager.test.ts — unit tests

## Implementation Steps
1. Implement src/runner/stateEntryManager.ts with class StateEntryManager exposing:
   - constructor(deps: { visitTracker, outputStore, notifyHandler, learningStore, contextApi, presenterFactory })
   - async enter(stateId: string, stateDef: StateDef): Promise<StateEntryResult>
2. Move logic for: max_visits checks (using VisitTracker), reset_outputs handling (call outputStore), recording history into context API, running notify commands, and creating Presenter instance (but not storing it globally).
3. Ensure enter() returns structured StateEntryResult: { continueTarget?: string | null, wasRecorded: boolean, presenter: Presenter }
4. Add unit tests to mock dependencies: VisitTracker, outputStore, notifyHandler, learningStore, context API and validate:
   - max_visits enforcement returns continue target when exceeded
   - reset_outputs triggers outputStore clearing
   - notify handler executed when configured
   - Presenter created and returned
5. Keep code focused; avoid moving unrelated behavior (execution, exports, approval internals).

## Acceptance Criteria
- [ ] StateEntryManager implemented and exported
- [ ] Unit tests for max_visits, reset_outputs, notify, and Presenter creation
- [ ] Part compiles when VisitTracker from Part 1 is present

## Context from Parent
From parent ticket (relevant excerpts):

- "Phase 2: Extract State Entry Logic"
  - Move enterState() method and related helpers
  - Dependencies: visitTracker, outputStore, notifyHandler, learningStore, context API, Presenter
  - Public methods: enter(stateId, stateDef) -> StateEntryResult
  - Handle: max_visits enforcement, reset_outputs, history recording, notify, approval variable initialization, presenter creation

Note: This part depends on Part 1 (VisitTracker). Keep the interface minimal to allow other managers to call enter() and receive Presenter for rendering.