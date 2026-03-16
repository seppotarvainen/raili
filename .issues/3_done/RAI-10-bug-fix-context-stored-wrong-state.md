# RAI-10: Fix context being stored into a wrong state

**Type:** bug

## Description
Current behavior persists approval and notify metadata into the next state's history entry instead of the state where the command/approval actually ran. This causes later states to not find expected context (vars/meta) on the originating state (e.g., workflow-test.yaml shows meta stored on "done" instead of "act"). Fix ensures notify, approval question, and approval answer are recorded on the active state when they occur.

## Documentation References
- documentation/states.md
- documentation/routing.md
- documentation/approval.md
- documentation/output.md

## Code References
- .raili/workflow-test.yaml (example reproducer)
- .raili/context.json (sample persisted context)
- src/context.ts (addStateToHistory, getCurrentState)
- src/engine/Engine.ts (Engine.run — approval persistence and notify handling)
- src/engine/ApproveStateRunner.ts (runApprovalStep)
- src/engine/ScriptStateRunner.ts (runScriptState)
- src/engine/AgentStateRunner.ts (runAgentState)
- src/engine/CommandStateRunner.ts (runCommandState)
- src/handlers/notifyHandler.ts (runNotify)
- src/handlers/manualHandler.ts (handleManualTransition)
- src/outputStore.ts (clearAgentOutputs)

## Acceptance Criteria
- [x] Engine persists state-level notify metadata into the current state's history entry immediately after notify executes.
- [x] Approval question and approval answer (chosen + reason) are persisted into the current state's history entry as soon as the prompt/decision occurs.
- [x] Unit tests added/updated under __tests__/unit verifying:
  - [x] notify metadata is stored on the active state when notify is run
  - [x] approval metadata is stored on the active state (not the next) after approval flow
  - [x] no regressions in state routing or vars export persistence
- [ ] Integration-style test under __tests__/integration (suggested) using .raili/workflow-test.yaml reproducer that asserts context.stateHistory entries contain expected meta in the originating state.
- [x] Documentation updated (brief note in documentation/states.md or documentation/approval.md) describing that notify and approval metadata are attached to the state where they occur.
- [ ] All tests pass (npm test)


