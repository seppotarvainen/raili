# RAI-21: User should choose which variables to store in run-log

**Type:** improvement

## Description
Allow workflow authors to mark which declared input variables should be included in the run-log. Some variables can be large or sensitive and should be excluded by default. Introduce an optional `log: boolean` property on input declarations that defaults to `false`, e.g.: 

```yaml
inputs:
  - name: myvar
    description: "My test variable"
    log: true
  - name: longvar
    description: "A long variable that shouldn't be logged"
```

This change keeps inputs collection unchanged but restricts what gets persisted to `.raili/<workflow>/run-log.jsonl` to only those inputs explicitly marked with `log: true`.

## Documentation References
- documentation/variables.md
- documentation/output.md

## Code References
- src/types.ts (InputDef)
- src/schemas.ts (WorkflowConfigSchema, FieldSchema)
- src/schemaValidator.ts (validateWorkflowConfig)
- src/workflowLoader.ts (loadWorkflowConfig, normalization of inputs)
- src/runLog.ts (appendRunLog)
- src/cli.ts (collectVars, loadVarsFile) — inputs parsing/normalization usage
- src/run.ts (runCommand, appendRunLog invocation)

## Acceptance Criteria
- [x] types.ts: InputDef extended to include optional `log?: boolean` with default semantics documented in code comments
- [x] schemas.ts & schemaValidator.ts: input object form accepts optional boolean `log` without throwing on unknown key; validation ensures `log` if present is boolean
- [x] workflowLoader.ts: normalized inputs preserve `log` flag when declared; shorthand string inputs continue to work (treated as {name, description: undefined, log: false})
- [x] runLog.ts: appendRunLog only includes workflowConfig.inputs entries where `log === true` in the `vars` object written to run-log.jsonl; default behavior is to exclude variables when `log` is omitted
- [x] CLI/collectVars behavior unchanged for variable collection or precedence (flags, vars file, interactive); only run-log composition changes
- [x] Unit tests added/updated under __tests__/unit covering:
  - schemaValidator accepts `log` in input objects and enforces boolean
  - workflowLoader normalization returns input objects with `log` boolean defaulting to false
  - runLog.appendRunLog excludes non-logged vars and includes logged ones
- [x] Integration test under __tests__/integration that simulates a run and asserts run-log.jsonl contains only the logged inputs
- [x] Documentation updated: documentation/variables.md (mention `log` flag and default false) and documentation/output.md updated if run-log behavior is documented there
- [ ] All tests pass (npm test)


---

Notes: This is an opt-in change for run-log persistence only. No backwards-compatibility action is required because omission of `log` will continue to exclude variables from run-log. Ensure schema validation and workflow normalization cover both shorthand (string) and object input forms.
