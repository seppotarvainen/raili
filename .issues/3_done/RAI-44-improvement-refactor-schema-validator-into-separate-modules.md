# RAI-44: Refactor schema validator into separate modules

**Type:** improvement

## Description
SchemaValidator (src/workflow/schemaValidator.ts) has grown large and mixes multiple responsibilities: field/type validation, object validation, state-level rules, var-reference collection, and workflow-level checks. Split internal logic into focused modules to improve maintainability, readability, and testability while preserving the current public API (so existing tests and imports remain unchanged).

## Documentation References
- documentation/workflow-yaml.md

## Code References
- src/workflow/schemaValidator.ts (validateWorkflowConfig, validateStateConfig, validateApprovalConfig, SchemaValidationError)
- src/workflow/schemas.ts (FieldSchema, ObjectSchema, StateConfigSchema, WorkflowConfigSchema)
- src/types.ts (StateConfig, WorkflowConfig, StateType)
- src/workflow/workflowLoader.ts (loadWorkflowConfig uses validateWorkflowConfig)

## Implementation Plan
Ordered steps to perform the refactor while keeping public API intact. Each step is explicit and surgical.

1. **Create** `src/workflow/schemaValidator/fieldValidator.ts` — move and export:
   - `validateFieldType(value, expectedType, fieldName)`
   - `validateField(fieldName, fieldValue, fieldSchema, stateType?, context?)`
   - Keep error throwing behavior identical (throw SchemaValidationError)

2. **Create** `src/workflow/schemaValidator/objectValidator.ts` — move and export:
   - `validateObject(obj, schema, context?, stateType?)`
   - Import and use functions from `fieldValidator.ts`

3. **Create** `src/workflow/schemaValidator/approvalValidator.ts` — move and export:
   - `validateApprovalConfig(config)` (thin wrapper calling objectValidator with ApprovalConfigSchema)

4. **Create** `src/workflow/schemaValidator/stateValidator.ts` — move and export:
   - `collectVarRefs(obj, refs)`, `collectFailFastVarRefs(stateConfig)`
   - `validateStateConfig(config, stateId)` including all state-specific custom checks (mutual exclusivity, expose constraints, max_visits checks, nested approval/feedback validation)
   - Use `objectValidator` and `approvalValidator` as needed

5. **Create** `src/workflow/schemaValidator/workflowValidator.ts` — move and export:
   - `validateWorkflowConfig(config)` including: initial/error existence checks, inputs validation, building knownVars set and undeclared-var checks
   - Use `stateValidator`, `collectFailFastVarRefs` and `objectValidator` as needed

6. **Replace** the body of `src/workflow/schemaValidator.ts` with a thin index that:
   - Imports the new modules and re-exports the public API exactly as before:
     - `export { validateWorkflowConfig, validateStateConfig, validateApprovalConfig, SchemaValidationError }`
   - Keep any exported types/names unchanged so external callers (workflowLoader.ts and tests) need no changes

7. **Add** unit tests for the new internal modules (optional but required by policy):
   - `__tests__/unit/schema/fieldValidator.test.ts`
   - `__tests__/unit/schema/stateValidator.test.ts`
   - These tests should mirror existing test cases (if any) and add a couple of focused cases for each module

8. **Run** project type-check and test suite
   - `npm test`
   - Fix any import/tsconfig issues introduced by new files

9. **Code cleanup**
   - Ensure no logic changed: run `npm test` and verify all existing tests pass unchanged
   - Optionally add a short README under `src/workflow/schemaValidator/README.md` describing module responsibilities

## Examples
Before (current single-file export):

```ts
// src/workflow/schemaValidator.ts
export function validateWorkflowConfig(config: any): WorkflowConfig { /* large file with helpers */ }
export function validateStateConfig(config: any, stateId: string): StateConfig { /* ... */ }
```

After (public API unchanged; internals split):

```ts
// src/workflow/schemaValidator.ts (index)
export { validateWorkflowConfig } from './schemaValidator/workflowValidator';
export { validateStateConfig } from './schemaValidator/stateValidator';
export { validateApprovalConfig } from './schemaValidator/approvalValidator';
export { SchemaValidationError } from './schemaValidator/errors';
```

YAML example (unchanged behavior):

```yaml
initial: start
states:
  start:
    type: agent
    agent: analyzer
    prompt: "Analyze ticket ${ticket_id}"
```

Expected behavior after refactor:
- All existing validation behavior is preserved (same errors/messages)
- `src/workflow/schemaValidator.ts` remains the public entry point for validation
- Internal modules are small and focused (field, object, state, workflow)

## Test Plan
Follow existing test patterns in `__tests__/integration/testUtils.ts` and existing unit tests.

### Unit tests (`__tests__/unit/`)
- File: `__tests__/unit/schema/fieldValidator.test.ts`
  - Test: "rejects wrong primitive types"
    - Setup: import `validateFieldType`/`validateField` from new module
    - Act: call with mismatched types (e.g., expected 'string', pass number)
    - Assert: throws SchemaValidationError with matching message fragment
- File: `__tests__/unit/schema/stateValidator.test.ts`
  - Test: "rejects state with both 'on' and 'transitions'"
    - Setup: minimal state object with both fields
    - Act: call `validateStateConfig(stateObj, 's1')`
    - Assert: throws SchemaValidationError containing "both 'on' and 'transitions'"
- File: `__tests__/unit/schema/workflowValidator.test.ts`
  - Test: "undeclared ${VAR} in fail-fast fields causes error"
    - Setup: workflow config where a state references ${MISSING} in a non-lenient field
    - Act: call `validateWorkflowConfig(cfg)`
    - Assert: throws SchemaValidationError referencing state and variable name

### Integration tests (`__tests__/integration/`)
Follow patterns from `__tests__/integration/testUtils.ts`:
- Use `createTmpWorkspace()` to create temporary workspace
- Use `writeWorkflow(tmp, yaml)` and registries as needed
- Mock `child_process.spawn` globally: `jest.mock('child_process', () => ({ spawn: jest.fn() }));`
- Use `fakeChild(stdout, stderr, exitCode)` for agent/script outputs

Test case: "loadWorkflowConfig preserves behavior after refactor"
```ts
const tmp = createTmpWorkspace();
writeWorkflow(tmp, `initial: start\nstates:\n start:\n  type: agent\n  agent: analyzer\n`);
writeAgentRegistry(tmp, { analyzer: { path: './agents/analyzer.md' } });
const { spawn } = require('child_process');
spawn.mockImplementation((cmd) => fakeChild('approve','',0));
await runCommand(tmp, 'clean', {});
const ctx = loadContext(tmp);
expect(ctx.stateHistory[ctx.stateHistory.length - 1].state).toBe('done');
```

Notes on mocks and helpers: use `fakeChild`, `createTmpWorkspace`, `writeWorkflow`, `writeAgentRegistry`, and `cleanupRailiEnvVars()` as shown in `__tests__/integration/testUtils.ts`.

## Acceptance Criteria
- [x] `src/workflow/schemaValidator.ts` remains the public entry point and exports the same functions: `validateWorkflowConfig`, `validateStateConfig`, `validateApprovalConfig`, and `SchemaValidationError`.
- [ ] Internal validation logic split into separate modules located under `src/workflow/schemaValidator/` (fieldValidator, objectValidator, stateValidator, workflowValidator, approvalValidator, errors)
- [ ] All existing unit and integration tests pass without modification (`npm test`)
- [ ] New unit tests added for the key internal modules (`__tests__/unit/schema/*`) covering at least 3 focused cases
- [ ] TypeScript compiles cleanly (`npm run build` or `tsc` where applicable)


---

Ticket metadata
- Slug: `refactor-schema-validator-into-separate-modules`


Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>
