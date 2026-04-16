# RAI-77 — Part 3: Integration tests and documentation

**Parent ticket:** RAI-77 (RAI-77-feature-next_steps_flag.md)

## Scope
Add integration tests that validate `--next` behavior end-to-end (clean runs, resume runs, approval handling) and update CLI documentation with examples. These tests exercise the full flow and rely on pt1 (types/CLI wiring) and pt2 (runner implementation).

## Files to Modify / Add
- documentation/cli/run.md — document `--next` flag behavior and examples
- __tests__/integration/next_steps.test.ts — integration tests covering single-run limit, resume with additional steps, and approval state behavior

## Implementation Steps
1. Add documentation entry under `documentation/cli/run.md` describing `--next`, examples (`--next`, `--next=2`), and notes about continue mode.
2. Create `__tests__/integration/next_steps.test.ts` using existing test helpers (`createTmpWorkspace`, `writeWorkflow`, `runCommand`, `loadContext`, `cleanupRailiEnvVars`) to cover:
   - Clean run with `--next=2` executes exactly 2 states
   - Bare `--next` executes 1 state from initial state
   - Resume behavior: first run executes 1, subsequent `--next=2` adds 2 more
   - Approval state with `--next=1` triggers approval prompt but stops after 1
3. Mock external processes (child_process.spawn) per existing integration test patterns.
4. Run integration tests locally to verify behavior.

## Acceptance Criteria
- [ ] Documentation updated with `--next` usage and examples
- [ ] Integration tests exist and validate resume and limit behavior
- [ ] Tests use established integration test helpers and clean up env vars

## Context from Parent
Relevant excerpts:
- Integration test examples and expectations (parent lines ~166-258), including suggested test code and behaviors for resume and approval states.


