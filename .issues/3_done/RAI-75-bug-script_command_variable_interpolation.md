
# RAI-75: Fix interpolation in script state arguments

**Type:** bug

## Description

Script state runner does not interpolate variables in its arguments. This causes variables like `${ticket_id}` to be passed literally to scripts instead of being replaced with their actual values. Agent and approval states already interpolate correctly, but the script state lacks this crucial feature.

## Documentation References

- documentation/variables.md (variable interpolation semantics)
- documentation/states.md (state type reference)

## Code References

- src/runner/scriptStateRunner.ts (runScriptState)
- src/handlers/scriptHandler.ts (executeScript)
- src/variables/variableInterpolation.ts (interpolateObject)

## Implementation Plan

1. **src/runner/scriptStateRunner.ts** — Import `interpolateObject` from `variableInterpolation.ts` and interpolate the `args` array before passing to `executeScript`. Use `throwOnMissing: true` (fail-fast).

2. **__tests__/unit/runner/scriptStateRunner.test.ts** — Add test case: "interpolates variables in script args" that verifies `args: ['${ticket}', 'fixed']` with `vars: {ticket: 'TICKET-123'}` results in `['TICKET-123', 'fixed']` being passed to executeScript.

3. **__tests__/integration/script.test.ts** — Add integration test: "interpolates variables in script args during workflow execution" using the testUtils pattern (mocked spawn, workflow YAML with args containing `${var}`).

## Examples

### Example workflow with script variable interpolation

```yaml
initial: archive
inputs: [ticket_id]

states:
  archive:
	type: script
	script: archive
	args:
	  - ${ticket_id}
	  - --format=json
```

**With `--var ticket_id=TICKET-123`:**
- Script is invoked with: `./path/to/archive TICKET-123 --format=json`
- NOT: `./path/to/archive ${ticket_id} --format=json`

### Expected behavior

After the fix, variables in script args will be resolved from context variables before execution:

- Missing variables with `throwOnMissing: true` → immediate error (fail-fast)
- Successfully resolved variables → script receives interpolated args

## Test Plan

### Unit tests (`__tests__/unit/`)

- **File:** `__tests__/unit/runner/scriptStateRunner.test.ts`
- **Test case:** "interpolates variables in script args"
  - Setup: Mock `executeScript`, create state with `args: ['${ticket}', 'file.zip']`
  - Act: Call `runScriptState()` with `vars: {ticket: 'TICKET-123'}`
  - Assert: Verify `executeScript` was called with args `['TICKET-123', 'file.zip']`

- **File:** `__tests__/unit/runner/scriptStateRunner.test.ts`
- **Test case:** "throws when interpolating undefined variable in script args"
  - Setup: Mock `executeScript`, create state with `args: ['${undefined_var}']`
  - Act: Call `runScriptState()` with `vars: {}`
  - Assert: Expect error containing "Variable 'undefined_var' is not defined"

### Integration tests (`__tests__/integration/`)

- **File:** `__tests__/integration/script.test.ts`
- **Test case:** "interpolates variables in script args during workflow execution"

```typescript
const tmp = createTmpWorkspace();
writeWorkflow(tmp, `
initial: backup
inputs: [filename]
states:
  backup:
	type: script
	script: archiver
	args:
	  - \${filename}
	  - backup.tar.gz
	on:
	  PASSED: done
	  FAILED: error
  done:
	type: engine
  error:
	type: engine
`);
writeScriptRegistry(tmp, { archiver: { path: './scripts/archive.sh' } });
writeScriptFile(tmp, 'scripts/archive.sh', '#!/bin/bash\necho "Archived: $1 to $2"');
spawn.mockImplementation((cmd: string, args?: string[]) => {
  if (cmd.includes('archive.sh')) {
	// Verify interpolation happened: args should be ['myfile.txt', 'backup.tar.gz']
	expect(args).toEqual(['myfile.txt', 'backup.tar.gz']);
	return fakeChild('Archived: myfile.txt to backup.tar.gz', '', 0);
  }
  return fakeChild('', '', 0);
});
await runCommand(tmp, 'clean', { filename: 'myfile.txt' });
const ctx = loadContext(tmp);
expect(ctx.stateHistory[ctx.stateHistory.length - 1].state).toBe('done');
```

## Acceptance Criteria

- [ ] Script state runner interpolates `args` array using `interpolateObject` with fail-fast (throwOnMissing: true)
- [ ] Unit test added to `__tests__/unit/runner/scriptStateRunner.test.ts` verifying args interpolation with variables
- [ ] Unit test added to `__tests__/unit/runner/scriptStateRunner.test.ts` verifying error thrown on undefined variable
- [ ] Integration test added to `__tests__/integration/script.test.ts` demonstrating full workflow execution with interpolated args
- [ ] All existing tests continue to pass (no regressions)
- [ ] Variables in script args are correctly replaced before execution
