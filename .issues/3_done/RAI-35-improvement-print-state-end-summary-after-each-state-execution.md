# RAI-35: Print state end summary after each state execution

**Type:** improvement

## Description
Print a concise, framed "state end" summary after every state completes. For states using binary `on` routing (PASSED/FAILED) show an emoji + result (e.g. ✅ PASSED). For named `transitions`, show an arrow emoji + transition key -> next state. Move this presentation logic into Presenter as a dedicated appendStateExit method, then call Presenter.render() so all formatting is centralized.

This improves UX by surfacing outcome, next state, and elapsed time in a consistent, testable way.

## Documentation References
- docs/workflow-yaml.md (if present)

## Code References
- src/runner/Runner.ts (Runner.run, routeToNext, handleApproval, handleFeedback)
- src/presenter.ts (Presenter class — add appendStateExit and rendering support)
- src/context/context.ts (add/consume enteredAt timestamp from stateHistory)

## Implementation Plan
Ordered changes with file and function-level detail. Read the referenced files before implementing.

1. **src/presenter.ts** — Add a new method `appendStateExit` to the `Presenter` class. Signature suggestion:
   - appendStateExit(stateDef: StateDef, outcome: string, next?: string, elapsedMs?: number): void
   - It should accept: the StateDef, the resolved outcome key (e.g., 'PASSED' or 'approve'), optional `next` state id, and elapsed time in milliseconds.
   - Compose lines similar to appendStateEnter but focused on end-summary: e.g. `✅ PASSED -> test | ⏱️Elapsed time: 2:28` or `➡️ approve -> nextState`.
   - Reuse existing `Lines` helper and framing behavior so render() continues to draw a bordered box.
   - Export the function as an instance method and ensure it sets `this.entry` or appends to lines so render() prints both enter+exit if desired.

2. **src/runner/Runner.ts** — Instrument state end points to call presenter.appendStateExit + presenter.render():
   - In the main loop, capture the state's enteredAt from the context history entry (the entry created in `addStateToHistory` during enterState).
   - Compute elapsed time after state execution (Date.now() - new Date(enteredAt).getTime()). Format elapsedMs to human-friendly mm:ss in Presenter.
   - After `const stateResult = await this.executeState(stateDef);` and after `this.handleExports(...);`, call presenter.appendStateExit(...) with outcome and leave `next` undefined for now. Then call presenter.render().
   - For approval flow (`handleApproval`): modify `handleApproval` to call presenter.appendStateExit with outcome and nextStateId (the one resolved) and render before recording/persisting metadata. Replace or remove console.log approval messages in favor of presenter output.
   - For feedback flow (`handleFeedback`) when it routes to a next state directly, call presenter.appendStateExit with the feedback-based `next` and outcome (use a standardized key like `FEEDBACK`) and render.
   - In `routeToNext`, after resolving `nextStateId`, instead of console.log(`  → ${nextStateId}`) call presenter.appendStateExit with outcome and nextStateId (outcome is the routing key) and render(), then record(nextStateId).
   - For terminal states (no routing), after recording success meta, call presenter.appendStateExit with outcome `'TERMINAL'` or `config.success` string and render. Replace console.log terminal message.
   - Ensure a single Presenter instance is used across entry/exit within a state execution (create a new Presenter at enterState and pass it to exit sites or attach one at the Runner instance level for single-state lifetime).

3. **src/presenter.ts** — Add unit testable formatting helpers (e.g., a private formatElapsed(ms) function exported for tests or test via behavior).

4. **Tests — Unit**
   - **__tests__/unit/presenter.test.ts** — Add tests for appendStateExit formatting:
     - Test case: PASSED (binary) — construct a small fake StateDef (type: script or agent) and call appendStateExit with outcome='PASSED', next='test', elapsedMs=148000 (2:28). Assert that lines.entries include the exact string `✅ PASSED -> test | ⏱️Elapsed time: 2:28` or equivalent framed output. Use jest.spyOn(console, 'log') to capture output from render().
     - Test case: transitions (named) — outcome='approve', next='done' should produce `➡️ approve -> done`.

5. **Tests — Integration**
   - **__tests__/integration/state-end-summary.test.ts** — Sketch:
     - Use createTmpWorkspace(), write a simple workflow with an agent state that returns a transition key (via fakeChild), run runCommand(tmp, 'clean', {}), spy on console.log to capture output, and assert that captured output contains the framed summary lines after state execution (use regex to match emoji and routing text). Follow existing patterns in __tests__/integration/agent.test.ts and testUtils.fakeChild.
     - Ensure cleanupRailiEnvVars() and workspace cleanup are used.

6. **Runner: Minor refactors**
   - If necessary, extract a small helper to find the last enteredAt for a state (from context.stateHistory) to keep code readable.

7. **Documentation**
   - Update docs/workflow-yaml.md or a short note in documentation/ that run prints a framed end-of-state summary using Presenter.

## Examples

### Example output (expected)

```
-----------------------------------------
✅ PASSED -> test | ⏱️Elapsed time: 2:28
```
or for transitions:
```
-----------------------------------------
➡️ approve -> done
```

### Example workflow YAML (no config changes required)
```yaml
initial: analyze
states:
  analyze:
    type: agent
    agent: test_agent
    transitions:
      approve: done
      reject: rework
  done:
    type: engine
```

### Before/After behavior
- Before: Runner prints small console messages like `  → nextState` and `approval: PASSED → next`.
- After: A framed, consistent end-summary appears immediately after state execution with emoji, outcome key or transition name, next state (if applicable), and elapsed time.

## Test Plan

### Unit tests (__tests__/unit/)
- **File:** __tests__/unit/presenter.test.ts
- **Test case:** "formats PASSED binary outcome with elapsed time"
  - Setup: Create presenter instance, fake StateDef { id: 'test', config: { type: 'agent' } }
  - Act: call appendStateExit(stateDef, 'PASSED', 'nextState', 148000); call render();
  - Assert: capture console.log via jest.spyOn and assert output includes `✅ PASSED -> nextState` and `Elapsed time: 2:28`.

- **Test case:** "formats transition key routing"
  - Setup: as above
  - Act: appendStateExit(stateDef, 'approve', 'done', 5000); render();
  - Assert: output contains `➡️ approve -> done`.

### Integration tests (__tests__/integration/)
- **File:** __tests__/integration/state-end-summary.test.ts
- **Test case:** "prints end summary after agent state"
  - Setup: createTmpWorkspace(), writeWorkflow with an agent that returns 'approve' as last stdout line; writeAgentRegistry and agent file; jest.mock('child_process') is already used in existing tests (reuse pattern).
  - Act: spy on console.log; run runCommand(tmp, 'clean', {});
  - Assert: captured logs contain framed output with arrow emoji and `approve -> done` as well as a line showing elapsed time format `mm:ss`.

Notes on mocking and helpers: follow __tests__/integration/testUtils.ts patterns: use fakeChild(stdout, stderr, exitCode), createTmpWorkspace(), writeAgentRegistry(), writeAgentFile(), cleanupRailiEnvVars(). Use jest.mock('child_process') and spawn.mockImplementation as in agent.test.ts.

## Acceptance Criteria
- [x] Presenter exposes appendStateExit(stateDef, outcome, next?, elapsedMs?) and formats messages as described.
- [x] Runner calls Presenter to render an end-summary after every state execution path (normal routing, approval routing, feedback routing, terminal states).
- [x] Unit tests for Presenter formatting pass and assert exact formatted fragments (emoji, outcome key, next state, elapsed mm:ss).
- [x] Integration test verifies framed end-summary is printed during a run with an agent state returning a transition key.
- [x] No behavioral changes to state routing or context persistence (only presentation changes).


---

*Implementation notes / guidance for the implementer:*
- Keep Presenter as the single source of truth for CLI formatting. Do not scatter console.log output across Runner; replace the small inline console logs with presenter calls.
- For elapsed time formatting prefer mm:ss unless over an hour (then `H:MM:SS`), implement helper in Presenter for testability.
- Use emoji: ✅ for PASSED, ❌ for FAILED, ➡️ for transition arrows.

