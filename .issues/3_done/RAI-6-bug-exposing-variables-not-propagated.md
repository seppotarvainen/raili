# RAI-6: Exposing variables doesn't work

**Type:** bug

## Description
A workflow-marked `expose` variable is not being made available to later states. The provided example runs a script state that is expected to produce an `id` export and a later command state that reads $RAILI_VAR_ID, but the command prints an empty value. The engine should fail-fast and give a clear error when an explicitly exposed variable is not produced by the state.

## Documentation References
- documentation/variables.md
- docs/workflow-yaml.md
- documentation/states.md

## Code References
- src/engine/Engine.ts (Engine: collects state exports, validates `expose`, persists context.vars)
- src/engine/ScriptStateRunner.ts (ScriptStateRunner: prepares env, parses exposes from stdout)
- src/engine/CommandStateRunner.ts (CommandStateRunner: prepares env, parses exposes from stdout)
- src/handlers/scriptHandler.ts (executeScript: spawns script process)
- src/handlers/commandHandler.ts (executeCommand: runs shell command)
- src/context.ts (loadContext, saveContext, initializeContext)
- src/variableInterpolation.ts (interpolation utilities; documents var usage elsewhere)
- scripts/next_id.sh (example script used to reproduce)

## Acceptance Criteria
- [x] If a state defines `expose: [<name>]` and the state produces no matching `name=value` output on stdout, the engine fails fast with a clear error explaining which variable was missing and from which state.
- [x] ScriptStateRunner and CommandStateRunner accept the documented `name=value` stdout pattern (case-insensitive key match, trimmed values) and record exports consistently.
- [x] Improve parsing to accept common patterns (e.g., `ID=123`, `export ID=123`, with or without trailing spaces) and document the exact expected format in documentation/variables.md.
- [x] Add unit tests in __tests__/unit covering:
  - ScriptStateRunner: when stdout contains `id=123` vs `export id=123` vs no line -> exports present/missing
  - CommandStateRunner: same cases
  - Engine integration: when `expose` configured and export missing -> engine throws and routes to error state (mock handlers)
- [x] Update documentation/variables.md and docs/workflow-yaml.md with a short example showing how a script should emit `name=value` lines and explain why `export` inside child process does not propagate to parent environment.
- [x] Provide an example correction for scripts/next_id.sh in documentation and tests demonstrating a working pattern.


<!-- Implementation notes (non-required):
- The root cause is likely that child-process `export VAR=...` sets variables only in the child process and does not print to stdout; the runner expects `name=value` lines on stdout. Two practical fixes: (A) Improve docs + clearer error message (preferred), (B) enhance parsers to accept `export NAME=VALUE` lines and strip the `export ` prefix. Optionally provide a small helper script template that echoes `id=$ID` before exiting.
-->
