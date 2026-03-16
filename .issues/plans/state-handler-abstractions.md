State & Handler Abstractions — Design Notes

Purpose

Introduce a minimal, typed contract for state runners and their handlers so shared plumbing (prompt interpolation, output storage, file-path loading, env handling) can be centralized while preserving Raili's thin deterministic engine.

Options considered

1) Abstract classes
   - Pros: share implementation, single-file overrides, discoverable methods
   - Cons: rigid inheritance, harder to mock in tests, less flexible for composition

2) Interfaces + concrete helpers (recommended)
   - Pros: lightweight, keeps implementations explicit, easy mocking, favors composition
   - Cons: slightly more boilerplate initially

3) Composition (pure functions + helpers)
   - Pros: maximal flexibility, test-friendly
   - Cons: more wiring per runner; less discoverable API surface

Prototype choice

Implement interfaces (StateRunner, HandlerResult, RunnerResult) in src/types.ts and provide a thin class-based prototype for AgentStateRunner that implements StateRunner and delegates side-effects to the existing agentHandler. This keeps existing engine imports stable while demonstrating the pattern.

Places to centralize/shared logic (files and functions)

- src/engine/AgentStateRunner.ts — prompt interpolation, previous output loading, output storing (prototype)
- src/engine/ScriptStateRunner.ts — similar to agent runner: args, output storing, expose parsing
- src/engine/CommandStateRunner.ts — command execution, working directory handling
- src/handlers/agentHandler.ts — parse frontmatter model + spawn logic (keep as handler impl)
- src/handlers/scriptHandler.ts — spawn script, arg forwarding
- src/outputStore.ts — already centralized; ensure consistent API
- src/variableInterpolation.ts — already centralized
- src/types.ts — add shared interfaces / contracts (done)
- src/engine/Engine.ts — use RunnerResult type and keep routing logic thin (updated)

Migration steps

1. Add interfaces in src/types.ts (done).
2. Prototype one runner+handler pair (Agent) to the new contract (done).
3. Add/update unit tests that mock handlers and verify engine routing remains identical.
4. Gradually refactor ScriptStateRunner and CommandStateRunner to implement StateRunner.
5. Keep adapter wrappers that expose previous function signatures for backward compatibility until all runners migrated.
6. Remove adapters and export classes directly from runner modules.

Testing & Rollout

- Run unit tests after each runner refactor; handlers remain mocked.

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>
