# RAI-80: Refactor runner.ts into focused modules

**Type:** chore

## Description

The `src/runner/runner.ts` file has grown to 821 lines and contains multiple distinct concerns: state machine traversal, context persistence, approval handling, feedback collection, teaching learnings, output management, and error recovery. This monolithic structure makes the code difficult to maintain, test, and reason about. A refactoring is needed to break it into smaller, focused modules that each handle a specific concern while preserving the Presenter instantiation pattern and fail-fast behavior. The main `Runner` class should orchestrate these modules to execute the workflow, with details delegated to focused, well-named classes.

## Documentation References
- documentation/states.md
- documentation/routing.md
- documentation/variables.md
- documentation/approval.md

## Code References
- src/runner/runner.ts (Runner class, all methods)
- src/presenter.ts (Presenter class — to be kept and used)
- src/types.ts (StateDef, StateMachine, WorkflowContext)
- __tests__/unit/runner/runner.test.ts (existing unit tests)
- __tests__/integration/testUtils.ts (mock patterns)

## Implementation Plan

### Phase 1: Extract Visit Tracking

1. **src/runner/visitTracker.ts** — Create new class `VisitTracker`
    - Move `visitCounts: Map<string, number>` field into VisitTracker
    - Move `stepsExecuted: number` and `countedStates: Set<string>` into VisitTracker
    - Extract methods: `incrementVisit(stateId: string): number`, `getVisitCount(stateId: string): number`, `recordStep(stateId: string): boolean`, `resetVisits(stateIds: string[]): void`, `hasReachedLimit(nextSteps: number): boolean`
    - No external dependencies beyond types

### Phase 2: Extract State Entry Logic

2. **src/runner/stateEntryManager.ts** — Create new class `StateEntryManager`
    - Move `enterState()` method and related helpers
    - Dependencies: `visitTracker`, `outputStore`, `notifyHandler`, `learningStore`, context API, Presenter
    - Public methods: `async enter(stateId: string, stateDef: StateDef): Promise<StateEntryResult>`
    - Return interface: `StateEntryResult { continueTarget: string | null; wasRecorded: boolean; presenter: Presenter }`
    - Handle: max_visits enforcement, reset_outputs, history recording, notify, approval variable initialization, presenter creation

### Phase 3: Extract Execution & Export Processing

3. **src/runner/stateExecutionManager.ts** — Create new class `StateExecutionManager`
    - Move `executeState()` and the state runner dispatch logic
    - Move `handleExports()` functionality here, since variable exports are a direct byproduct of execution.
    - Dependencies: agentStateRunner, scriptStateRunner, commandStateRunner, context API
    - Public method: `async executeAndExport(stateId: string, stateDef: StateDef, context: WorkflowContext): Promise<StateResult>`

### Phase 4: Extract Interactive Flows (Approval & Feedback)

4. **src/runner/interactiveFlowManager.ts** — Create new class `InteractiveFlowManager`
    - Combine approval and feedback logic
    - Move `handleApproval()` and `handleFeedback()` methods
    - Dependencies: approveStateRunner, manualHandler, context API, Presenter, pathUtils, resolverConfigLoader
    - Public methods: 
      - `async handleApproval(stateId: string, stateDef: StateDef, presenter?: Presenter): Promise<string>`
      - `async handleFeedback(stateId: string, stateDef: StateDef, context: WorkflowContext, presenter?: Presenter): Promise<string | null>`
    - Return: next state ID after approval decision, or feedback-routed next state ID
    - Handle: approval variable exposure, feedback timeout resolution, and metadata persistence

### Phase 5: Extract Teaching Logic

5. **src/runner/teachManager.ts** — Create new class `TeachManager`
    - Move `handleTeach()` method
    - Dependencies: learningStore, outputStore, context API
    - Public method: `async teach(stateId: string, stateDef: StateDef, context: WorkflowContext): Promise<void>`
    - Fail-fast on missing variables or empty outputs

### Phase 6: Consolidate Routing & Error Recovery

6. **src/runner/routingManager.ts** — Create new class `RoutingManager`
    - Combine normal routing, skip logic, and error recovery routing into a single cohesive routing module.
    - Move `routeToNext()`, `handleSkip()`, and `handleError()` methods
    - Dependencies: transition.ts, Presenter, outputStore, notifyHandler, context API
    - Public methods: 
      - `evaluateSkip(stateId: string, stateDef: StateDef, stateMachine: StateMachine): string | null`
      - `routeToNext(stateId: string, stateDef: StateDef, outcome: string, stateMachine: StateMachine, presenter?: Presenter): string`
      - `routeError(err: unknown, stateMachine: StateMachine, context: WorkflowContext, cwd: string, workflowArg?: string): Promise<boolean>`
    - Rationale: Error recovery is effectively just fallback routing. Skip is pre-emptive routing. Managing them in one place reduces fragmentation.

### Phase 7: Refactor Runner Class

7. **src/runner/runner.ts** — Update `Runner` class to orchestrate managers
    - Keep existing `RunnerConfig` interface and constructor
    - Keep field: `currentPresenter?: Presenter | null` (instantiate only in Runner)
    - Instantiate all manager classes in constructor or as lazy-loaded properties
    - Keep public method: `async run(): Promise<void>`
    - Replace method bodies with calls to appropriate managers
    - Main `run()` loop orchestrates: Skip → Enter → Terminal Check → Execute/Export → Approval/Feedback → Teach → Route → Error Recovery

### Phase 8: Update Imports & Exports

8. **src/runner/index.ts** (optional) — Create barrel export if needed
    - Export Runner, StateResult, RunnerConfig, managers (if external code needs them)

### Phase 9: Update Tests

9. **__tests__/unit/runner/runner.test.ts** — Update existing unit tests
    - Tests still focus on Runner.run() behavior; mocking patterns unchanged
    - Import and mock managers where needed
    - Ensure all existing test cases still pass

10. **__tests__/unit/runner/visitTracker.test.ts** (new) — Add unit tests for VisitTracker
    - Test: visit count increment, reset, step recording
    - Mock: none (pure logic)

11. **__tests__/unit/runner/stateEntryManager.test.ts** (new) — Add unit tests
    - Mock: visitTracker, outputStore, notifyHandler, learningStore, context module
    - Test: max_visits enforcement, reset_outputs handling, presenter creation

12. **__tests__/unit/runner/interactiveFlowManager.test.ts** (new) — Add unit tests
    - Mock: approveStateRunner, manualHandler, context module, resolver config 
    - Test: approval decision routing, variable exposure, next state resolution
    - Test: feedback collection, timeout handling, conditional routing

13. **__tests__/unit/runner/teachManager.test.ts** (new) — Add unit tests
    - Mock: learningStore, outputStore, context module
    - Test: teach with output, teach with var, missing var error, empty output error

14. **__tests__/unit/runner/routingManager.test.ts** (new) — Add unit tests
    - Mock: transition.ts, Presenter, outputStore, notifyHandler
    - Test: skip routing evaluation
    - Test: continue routing, outcome-based routing, default key resolution
    - Test: error routing to error state, missing error state error

15. **__tests__/integration/** — Run existing integration tests
    - All integration tests should pass without modification
    - Verify: agent flow, approval flow, feedback flow, teach flow, routing, error states

## Examples

### Before: Monolithic runner.ts snippet
```typescript
// Inside Runner class: 821 lines total, mixed concerns
private async enterState(stateId: string, stateDef: StateDef): Promise<...> {
  // max_visits logic
  // reset_outputs handling
  // history recording
  // notify execution
  // approval variable setup
  // presenter creation
}

private handleExports(...) { ... }
private async handleApproval(...) { ... }
private async handleFeedback(...) { ... }
private async handleTeach(...) { ... }
private routeToNext(...) { ... }
private async handleError(...) { ... }

async run(): Promise<void> {
  // All concerns mixed in main loop
  while (true) {
    const skipTarget = this.handleSkip(stateId, stateDef);
    const { continueTarget } = await this.enterState(stateId, stateDef);
    const result = await this.executeState(stateDef);
    this.handleExports(stateId, stateDef, result);
    // ... approval, feedback, teach, routing, error handling ...
  }
}
```

### After: Modular runner.ts orchestration
```typescript
// src/runner/runner.ts - Now an orchestrator
export class Runner {
  private readonly stateMachine: StateMachine;
  private readonly context: WorkflowContext;
  private currentPresenter?: Presenter | null;  // Instantiated only here

  private readonly visitTracker = new VisitTracker();
  private readonly stateEntryManager = new StateEntryManager(...);
  private readonly executionManager = new StateExecutionManager(...);
  private readonly interactiveFlowManager = new InteractiveFlowManager(...);
  private readonly teachManager = new TeachManager(...);
  private readonly routingManager = new RoutingManager(...);

  async run(): Promise<void> {
    let currentStateId = this.resolveStartState();

    while (true) {
      try {
        const stateDef = this.stateMachine.states[stateId];

        // Phase 1: Skip
        const skipTarget = this.routingManager.evaluateSkip(stateId, stateDef, this.stateMachine);
        if (skipTarget) { stateId = skipTarget; continue; }

        // Phase 2: Enter state
        const { presenter } = await this.stateEntryManager.enter(stateId, stateDef);
        this.currentPresenter = presenter;

        // Phase 3-7: Execute, approval, feedback, teach, route
        const result = await this.executionManager.executeAndExport(stateId, stateDef, this.context);
        
        if (config.approval) {
          stateId = await this.interactiveFlowManager.handleApproval(stateId, stateDef, presenter);
          continue;
        }
        
        const feedbackNext = await this.interactiveFlowManager.handleFeedback(stateId, stateDef, this.context, presenter);
        if (feedbackNext) { stateId = feedbackNext; continue; }
        
        await this.teachManager.teach(stateId, stateDef, this.context);
        stateId = this.routingManager.routeToNext(stateId, stateDef, result.outcome, this.stateMachine, presenter);

      } catch (err) {
        const handled = await this.routingManager.routeError(err, this.stateMachine, this.context, this.cwd, this.workflowArg);
        if (handled) return;
        throw err;
      }
    }
  }
}
```

## Test Plan

### Unit tests (`__tests__/unit/runner/`)

#### VisitTracker
- **File:** `__tests__/unit/runner/visitTracker.test.ts`
- **Test case:** "increments visit count and returns new count"
    - Setup: Create VisitTracker, state never visited before
    - Act: Call `incrementVisit('start')`
    - Assert: Returns 1, subsequent call returns 2

- **Test case:** "resetVisits clears visit counts for specified states"
    - Setup: Create VisitTracker, increment multiple states
    - Act: Call `resetVisits(['start'])`
    - Assert: 'start' visit count is reset, other states unchanged

- **Test case:** "recordStep increments stepsExecuted on first encounter"
    - Setup: Create VisitTracker with `nextSteps = 3`
    - Act: Call `recordStep('s1')` three times, then check `hasReachedLimit(3)`
    - Assert: Returns true after 3 calls

#### StateEntryManager
- **File:** `__tests__/unit/runner/stateEntryManager.test.ts`
- **Test case:** "enforces max_visits and routes to continue target"
    - Setup: Mock visitTracker to return visits > max_visits count, setup state with continue target
    - Act: Call `enter(stateId, stateDef)`
    - Assert: Returns continueTarget (not null), record called with max_visits metadata

- **Test case:** "clears reset_outputs and fires notify on entry"
    - Setup: Mock outputStore, notifyHandler; create state with reset_outputs and notify
    - Act: Call `enter(stateId, stateDef)`
    - Assert: clearAgentOutputs called, runNotify called, record includes notify metadata

- **Test case:** "creates Presenter and exposes approval variable names"
    - Setup: Create state with approval config
    - Act: Call `enter(stateId, stateDef)`, inspect returned presenter and context vars
    - Assert: Presenter created, `${stateId}_PASSED` and `${stateId}_FAILED` in context.vars

#### InteractiveFlowManager
- **File:** `__tests__/unit/runner/interactiveFlowManager.test.ts`
- **Test case:** "routes PASSED approval to correct next state"
    - Setup: Mock runApprovalStep to return `{ chosen: 'PASSED', question: '...', reason: '...' }`
    - Act: Call `handleApproval(stateId, stateDef, ...)`
    - Assert: Returns approval.PASSED target state, approval metadata recorded, vars updated with reason

- **Test case:** "routes FAILED approval to correct next state"
    - Setup: Mock runApprovalStep to return `{ chosen: 'FAILED', ... }`
    - Act: Call `handleApproval(stateId, stateDef, ...)`
    - Assert: Returns approval.FAILED target state

- **Test case:** "collects feedback and routes to feedback.next if configured"
    - Setup: Mock handleFeedbackPrompt to return 'user_input', state has feedback with transitions.next
    - Act: Call `handleFeedback(stateId, stateDef, ...)`
    - Assert: Returns transitions.next, feedback persisted to context.feedbacks, expose_var set in context.vars

- **Test case:** "returns null when no feedback routing configured"
    - Setup: State has feedback but no transitions.next
    - Act: Call `handleFeedback(stateId, stateDef, ...)`
    - Assert: Returns null, feedback still persisted

#### TeachManager
- **File:** `__tests__/unit/runner/teachManager.test.ts`
- **Test case:** "teaches output content to agent"
    - Setup: Mock readLatestRun to return 'some content', appendUniqueLearning mocked
    - Act: Call `teach(stateId, stateDef with teach[agent_id][0]={output: 'ref_state'}, ...)`
    - Assert: appendUniqueLearning called with content from readLatestRun

- **Test case:** "throws when referenced output is empty"
    - Setup: Mock readLatestRun to return empty string
    - Act: Call `teach(stateId, stateDef with teach, ...)`
    - Assert: Throws error with message containing "produced no content"

- **Test case:** "teaches variable value to agent"
    - Setup: Context has vars, teach[agent_id][0]={var: '${MY_VAR}'}
    - Act: Call `teach(stateId, stateDef, context with vars)`
    - Assert: appendUniqueLearning called with variable value

#### RoutingManager
- **File:** `__tests__/unit/runner/routingManager.test.ts`
- **Test case:** "returns skip target if skip evaluated to true"
    - Setup: stateDef.config.skip defined and matches criteria
    - Act: Call `evaluateSkip(...)`
    - Assert: Returns skip target

- **Test case:** "routes via continue when present"
    - Setup: stateDef.config.continue = 'target_state'
    - Act: Call `routeToNext(...)`
    - Assert: Returns 'target_state', presenter.appendStateExit called with 'CONTINUE'

- **Test case:** "routes to error state and returns true when declared"
    - Setup: stateMachine.error = 'error_state', state found in states
    - Act: Call `routeError(new Error('test'), stateMachine, context, ...)`
    - Assert: Returns true, record called with 'error_state', notify fired if configured

- **Test case:** "throws on illegal outcome not in routing"
    - Setup: stateDef.config.on = {PASSED: 'next'}, outcome = 'INVALID'
    - Act: Call `routeToNext(stateId, stateDef, 'INVALID', stateMachine)`
    - Assert: Throws error mentioning "INVALID" and defined outcomes

#### ErrorRecoveryManager
- **File:** `__tests__/unit/runner/errorRecoveryManager.test.ts`
- **Test case:** "routes to error state and returns true when declared"
    - Setup: stateMachine.error = 'error_state', state found in states
    - Act: Call `handleError(new Error('test'), stateMachine, context, ...)`
    - Assert: Returns true, record called with 'error_state', notify fired if configured

- **Test case:** "returns false when no error state declared"
    - Setup: stateMachine.error is undefined
    - Act: Call `handleError(...)`
    - Assert: Returns false (caller will re-throw)

### Integration tests (`__tests__/integration/`)

All existing integration tests should continue to pass without modification. No new integration tests are required for the refactoring, but the following should be verified:

- `agent.test.ts` — Agent state with transitions routing
- `approval.teach.integration.test.ts` — Approval + teach flow
- `feedback.integration.test.ts` — Feedback flow
- `learning.integration.test.ts` — Learning persistence
- `skip.integration.test.ts` — Skip phase
- `success.integration.test.ts` — Terminal states and success flag

**Verification pattern:**
```typescript
// Example: existing integration test should pass as-is
const tmp = createTmpWorkspace();
writeWorkflow(tmp, '...');
writeAgentRegistry(tmp, {...});
spawn.mockImplementation(...);
await runCommand(tmp, 'clean', {});
const ctx = loadContext(tmp);
expect(ctx.stateHistory[ctx.stateHistory.length - 1].state).toBe('done');
```

## Acceptance Criteria

- [ ] VisitTracker class created with visit count and step tracking logic extracted
- [ ] StateEntryManager created with max_visits, reset_outputs, history, notify, approval var initialization extracted
- [ ] StateExecutionManager created, merging execution routing and export handling
- [ ] InteractiveFlowManager created with approval decision, variable exposure, and feedback collection handling combined
- [ ] TeachManager created with teach mappings and learning persistence extracted
- [ ] RoutingManager created, merging normal routing, skip evaluation, and error state routing
- [ ] Runner class refactored to instantiate and orchestrate the 5 managers; Presenter still instantiated only in Runner
- [ ] All manager classes follow Presenter-style pattern: clear responsibility, dedicated public methods, proper encapsulation
- [ ] Existing unit tests in `__tests__/unit/runner/runner.test.ts` updated to pass with new structure
- [ ] New unit test files created for each manager (6 new test files)
- [ ] All existing integration tests pass without modification
- [ ] No change in external API: Runner class signature and run() method behavior identical
- [ ] Code compiles with no TypeScript errors
- [ ] No regression in fail-fast behavior: illegal transitions, missing variables, max_visits exceeded still throw immediately
- [ ] Presenter pattern preserved: instantiated only in Runner, passed to managers for rendering
