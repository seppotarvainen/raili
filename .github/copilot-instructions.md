# Raili – Architecture & Coding Rules

## 1. Separation of Concerns (Strict)

- **State machine** defines workflow structure only.
- **Engine** controls transitions only.
- **Handlers** perform side effects (agent, script, prompt).
- **Registries** map names → implementations.
- No business logic inside state definitions.

---

## 2. Deterministic Core

- All transitions must be explicit.
- No hidden state.
- Illegal transitions must throw errors.
- Engine behavior must be predictable and reproducible.

---

## 3. Fail Fast

- `.raili/` must exist before `raili run`.
- Registries must exist and be valid.
- Missing agents/scripts must cause immediate failure.
- No silent fallbacks.

---

## 4. No Hardcoding

- No agent names or script paths inside engine.
- Everything must resolve via registries.
- Workflow config is read-only during execution.

---

## 5. Thin Engine

- Keep core small and simple.
- Move complexity to handlers.
- Do not implement a dynamic DSL engine in MVP.

---

## 6. Testing Policy (Important)

- The **core engine must have unit tests**.
- Test transitions, illegal transitions, and loopbacks.
- Test registry validation and fail-fast behavior.
- Mock all external side effects (LLM, shell, prompts).
- Do not test real shell execution or real agent calls.

> Raili is a deterministic workflow engine with pluggable side effects — not a distributed orchestration platform.