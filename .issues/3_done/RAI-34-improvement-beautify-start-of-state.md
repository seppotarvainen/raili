# RAI-34: Beatify the start of a state

**Type:** improvement

## Description
Improve the console presentation when entering a state by introducing a new Presenter class that renders a boxed, emoji-enhanced header for the state entry (see example in the request). This centralizes presentation logic so it can be extended later and keeps Runner.enterState focused on workflow mechanics. The presenter should receive: global entry count ("#3" = total states entered so far), the state name (e.g., "CODING"), the state type (agent/command/script/engine) and meta lines (Entered timestamp, Visit count, Learnings applied / No earlier run output).

## Documentation References
- documentation/states.md
- docs/workflow-yaml.md [File removed as redundant (26.3.2026)]
- docs/raili-mvp.md

## Code References
- src/runner/Runner.ts (enterState)
- src/runner/StateRunner.ts (IStateRunner interface)
- src/runner/AgentStateRunner.ts (agent runner; learnings flow) 
- src/runner/ApproveStateRunner.ts (approval rendering behavior)
- src/runner/stateRunnerUtils.ts (shared utilities used by runners)
- src/context/context.ts (addStateToHistory, getCurrentState)

## Implementation notes
- Add a new Presenter class at src/presenter/Presenter.ts exporting a function/class that renders the boxed header to stdout (console.log). Provide a simple API, e.g.:
  - new Presenter().renderEntry({ count: number, stateName: string, type: 'agent'|'command'|'script'|'engine', enteredAt: string, visit: number, learningsApplied: boolean, learningNote?: string })
- Emoji mapping: 🤖 = agent, 📢 = command, 📜 = script, ⚙️ = engine
- Update Runner.enterState to call Presenter.renderEntry immediately after persisting the new history entry (so that count and enteredAt reflect persisted values). The runner must pass the total states-entered count (context.stateHistory.length) and current state info for details.
- Presenter must be purely presentational and have no side effects except calling console.log. Keep formatting logic inside Presenter so it can be extended later.

## Example

Use this as a reference for the console output format when entering a state. The emoji and state name/type should change based on the actual state being entered, and the meta lines should reflect real data.
+----------------------------------------------------------------------------------------------+
|  🤖 #3 CODING                                                                                |
+----------------------------------------------------------------------------------------------+
|  ⏱️ Entered: 2026-03-18T10:32:00Z.                                                           |
|  🔁 Visit: 1                                                                                 |
|  ✅ Learnings applied                                                                        |
|     No earlier run output                                                                    |
+----------------------------------------------------------------------------------------------+


## Acceptance Criteria
- [x] New file exists: src/presenter/Presenter.ts exporting the Presenter with method renderEntry(...) and documented public API. (Implemented as src/presenter.ts with Presenter class; tests and Runner import from src/presenter.)
- [x] Runner.enterState uses Presenter.renderEntry and passes: incremented global entry count, state name (uppercased), state type, ISO enteredAt timestamp, visit count for the state, and whether learnings were applied or "No earlier run output" note.
- [x] Console output for entering a state matches the requested boxed layout (example shown) for each state type with correct emoji.
- [x] Unit tests added/updated in __tests__/unit that:
    - mock console.log and assert the Presenter outputs the expected lines for an agent and for an engine state
    - verify Runner.enterState calls Presenter.renderEntry with the correct arguments (use a Presenter mock)
- [ ] Integration test suggestion: add a test under __tests__/integration that runs a minimal workflow and asserts the boxed header appears in the captured stdout when a state is entered.
- [ ] All existing tests pass (npm test)
- [x] Documentation updated: add a short note to documentation/states.md describing the Presenter and console entry format.

## Notes / Rationale
Centralizing state-entry presentation makes the runner thinner and follows the project's separation-of-concerns rule: the runner controls transitions, while presentation belongs to a dedicated presenter. This enables future features (color themes, verbosity flags, richer per-state metadata) without changing runner logic.

## Implementation status (2026-03-22)
- [x] Presenter implemented at src/presenter.ts (exported class Presenter with renderEntry)
- [x] Runner.enterState updated to call Presenter.renderEntry after persisting history (unit tests assert this)
- [x] Unit tests updated: console.log is mocked and runner.presenter.test.ts now mocks Presenter before importing modules
- [x] Documentation note added (documentation/states.md)

Remaining:
- [ ] Integration test suggestion (optional): add __tests__/integration that asserts boxed header appears in stdout
- [ ] Run full test suite (npm test) in CI to confirm all tests pass; if failures appear, will iterate.

Notes:
The failing unit test (Runner.enterState -> Presenter.renderEntry) was due to the Presenter mock being declared after module imports. The test was adjusted to mock the Presenter at the top of the file so Jest provides a mock implementation for Runner to call. This is a minimal, surgical change that leaves runtime code untouched.
