# RAI-63: Add `raili listen` mode for event-driven workflow triggering

**Type:** feature

## Description

Currently Raili must be started manually with `raili run`. This feature adds a new `raili listen` command that enables event-driven workflow automation. The command polls an external trigger function at regular intervals (1 minute). When the trigger detects an event (e.g., new Trello card, Jira label added), it returns workflow variables; Raili then starts a clean run with those variables. If the trigger fails for more than 10 minutes, Raili logs an error and exits to prevent indefinite broken-state execution.

## Documentation References

- documentation/states.md (context for workflow execution)
- documentation/variables.md (variable interpolation and workflow inputs)

## Code References

- src/cli.ts (main entry point, command dispatch)
- src/cli/railiCommand.ts (command parser)
- src/run.ts (runCommand orchestration)
- src/context/pathUtils.ts (resolver path resolution)
- src/handlers/manualHandler.ts (async module loader pattern reference)
- src/types.ts (RailiRunArgs type)

## Implementation Plan

1. **src/cli/railiCommand.ts** — Add `listen` command detection:
   - Add `listen: boolean` property to `RailiCommand` class
   - Add check in constructor: `this.listen = this.value === 'listen'`

2. **src/cli.ts** — Add `listen` command dispatch in `main()`:
   - Import `listenCommand` from new `./cli/listen.ts`
   - Add `else if (command.listen) { ... }` block after the `teach` block
   - Parse `--workflow` flag and optional `-w` short form
   - Call `await listenCommand(process.cwd(), workflowPath)` with error handling
   - Exit with code 0 on success or non-zero on error (following existing pattern)
   - Use same error logging as other commands: `console.error(err.message)`

3. **src/cli/listen.ts** (new file) — Main listen command implementation:
   - Export `export async function listenCommand(cwd: string, workflowPath?: string): Promise<void>`
   - Fail-fast: Verify `.raili/` exists (reuse pattern from `runCommand`)
   - Load workflow config and validate registries (reuse from `runCommand`: `validateAgentRegistry`, `validateScriptRegistry`, `validateWorkflowReferences`)
   - Resolve trigger file path using `resolveTriggerPath(workflowDir)` from pathUtils (see step 4)
   - **Fail-fast:** If `trigger.js` does not exist, throw error immediately: `"Trigger file not found. Expected: .raili/<workflow>/trigger.js"`
   - Load trigger module using `loadTriggerModule(triggerPath)` from handlers (see step 5)
   - Initialize polling loop:
     - Set `failureStartTime = null` (tracks when failures began)
     - Set `pollIntervalMs = 60000` (1 minute)
     - Set `failureTimeoutMs = 10 * 60 * 1000` (10 minutes)
   - Enter infinite loop (users can Ctrl+C to exit):
     - Call trigger function: `const event = await triggerModule()`
     - If event is null: wait `pollIntervalMs`, reset `failureStartTime`, continue
     - If event is non-null (object):
       - Reset `failureStartTime` to null
       - Extract key/value pairs from event and pass as `--var` flags to `runCommand`
       - Call: `await runCommand(cwd, 'clean', event, workflowPath, false)`
       - After run completes, wait `pollIntervalMs` before polling again
     - If trigger throws (or any other error):
       - Log error: `console.error(`Trigger error: ${error.message}`)`
       - If `failureStartTime` is null, set it to `Date.now()`
       - If current time - `failureStartTime` > `failureTimeoutMs`, log and exit:
         - `console.error(`Polling failed for > 10 minutes. Exiting.`)`
         - `process.exit(1)`
       - Otherwise wait `pollIntervalMs` and retry

4. **src/context/pathUtils.ts** — Add trigger path resolver:
   - Export `resolveTriggerPath(workflowDir: string): string | null`
   - Check if `.raili/<workflow>/trigger.js` exists
   - Return absolute path if exists, otherwise null

5. **src/handlers/manualHandler.ts** — Add trigger loader (or new handlers file):
   - Export async function `loadTriggerModule(triggerPath: string): TriggerFunction`
   - Define interface: `TriggerFunction = () => Promise<Record<string, string> | null>`
   - Use `require()` to load the module (same pattern as approval/feedback resolvers)
   - Fail-fast: If module doesn't export an async function, throw immediately
   - Return the loaded function

6. **src/init.ts** — Update init template (optional but recommended):
   - Add comment to workflow.yaml template explaining the listen mode and trigger.js discovery
   - Example: `# Optional: Create .raili/main/trigger.js for event-driven runs via 'raili listen'`
   - (No scaffold needed; users create trigger.js manually)

## Examples

### Trigger module structure

**File:** `.raili/main/trigger.js`

```javascript
module.exports = async function trigger() {
  // Your polling + auth logic
  const card = await pollTrello();
  
  if (!card) {
    return null; // Nothing ready yet; polling will retry
  }
  
  // Return key/value object when event is ready
  return {
    title: card.name,
    intent: card.description,
    ticket_id: card.id,
  };
};
```

### Workflow using trigger variables

**File:** `.raili/main/workflow.yaml`

```yaml
initial: process_card
inputs:
  - name: title
    description: Card title from Trello
  - name: intent
    description: Card description
  - name: ticket_id
    description: Trello card ID

states:
  process_card:
    type: agent
    agent: card_processor
    prompt: "Process this card: ${title} - ${intent} (ID: ${ticket_id})"
    transitions:
      complete: done
      
  done:
    type: engine
    success: true
```

### Expected behavior

When running `raili listen` (or `raili listen --workflow custom-workflow`):

1. Validates `.raili/` structure and registries (fail-fast)
2. Checks for `.raili/main/trigger.js` (or `.raili/<workflow>/trigger.js`)
3. If missing: exits immediately with error
4. If exists: enters polling loop
5. Every 60 seconds: calls trigger function
6. If trigger returns null: waits, continues polling
7. If trigger returns object (e.g., `{ title: "...", intent: "...", ticket_id: "..." }`):
   - Starts clean workflow run: `raili run --clean --var title=... --var intent=... --var ticket_id=...`
   - Waits for run to complete
   - Waits 60 seconds
   - Polls trigger again
8. If trigger throws error:
   - Logs error
   - If errors continue > 10 minutes: exits with error code 1
   - Otherwise retries after 60 seconds

### Console output example

```
$ raili listen
Listening for events. Polling interval: 1m, failure timeout: 10m (Ctrl+C to stop)
[2026-04-03T17:30:00Z] Polling trigger...
[2026-04-03T17:30:00Z] No event ready.
[2026-04-03T17:31:00Z] Polling trigger...
[2026-04-03T17:31:05Z] Event detected: { title: "Add analytics", intent: "Track user behavior", ticket_id: "TRL-42" }
[2026-04-03T17:31:05Z] Starting workflow run with variables...
[2026-04-03T17:31:30Z] Workflow run completed successfully.
[2026-04-03T17:32:00Z] Polling trigger...
```

## Test Plan

### Unit tests (`__tests__/unit/`)

- **File:** `__tests__/unit/cli/listen.test.ts`
- **Test case:** "listenCommand throws when trigger.js does not exist"
  - Setup: Create temp workspace with .raili/, write workflow.yaml, but no trigger.js
  - Act: Call `listenCommand(tmpDir, 'main')`
  - Assert: Should throw error matching "Trigger file not found"

- **Test case:** "listenCommand throws when trigger.js does not export a function"
  - Setup: Write `.raili/main/trigger.js` exporting non-function (e.g., `module.exports = 'string'`)
  - Act: Call `listenCommand(tmpDir, 'main')`
  - Assert: Should throw error matching "does not export"

- **File:** `__tests__/unit/handlers/manualHandler.test.ts` (add to existing tests)
- **Test case:** "loadTriggerModule loads and executes trigger function"
  - Setup: Mock filesystem, create trigger.js returning `{ key: 'value' }`
  - Act: Call `loadTriggerModule(triggerPath)`, then call returned function
  - Assert: Should return `{ key: 'value' }`

- **Test case:** "loadTriggerModule throws on invalid module"
  - Setup: Create trigger.js exporting non-function
  - Act: Call `loadTriggerModule(triggerPath)`
  - Assert: Should throw error

- **File:** `__tests__/unit/context/pathUtils.test.ts` (add to existing tests)
- **Test case:** "resolveTriggerPath returns path when trigger.js exists"
  - Setup: Create .raili/main/trigger.js
  - Act: Call `resolveTriggerPath(workflowDir)`
  - Assert: Should return absolute path to trigger.js

- **Test case:** "resolveTriggerPath returns null when trigger.js missing"
  - Setup: Create .raili/main/ but no trigger.js
  - Act: Call `resolveTriggerPath(workflowDir)`
  - Assert: Should return null

### Integration tests (`__tests__/integration/`)

Follow the established patterns from `__tests__/integration/testUtils.ts`:

- **File:** `__tests__/integration/listen.test.ts`

- **Test case:** "listen exits immediately when trigger.js missing"
  ```typescript
  // Sketch
  const tmp = createTmpWorkspace();
  writeWorkflow(tmp, `initial: start\nstates:\n  start:\n    type: engine`);
  writeAgentRegistry(tmp, {});
  writeScriptRegistry(tmp, {});
  // Do NOT write trigger.js
  
  // Mock clock and runCommand to avoid infinite loop
  jest.useFakeTimers();
  
  try {
    await listenCommand(tmp);
    fail('Expected to throw');
  } catch (err) {
    expect((err as Error).message).toMatch(/Trigger file not found/);
  }
  ```

- **Test case:** "listen polls trigger, executes workflow on event, then resumes polling"
  ```typescript
  // Sketch
  const tmp = createTmpWorkspace();
  writeWorkflow(tmp, `
initial: process
states:
  process:
    type: command
    command: "echo done"
    on:
      PASSED: done
  done:
    type: engine
  `);
  writeAgentRegistry(tmp, {});
  writeScriptRegistry(tmp, {});
  
  // Write trigger.js that returns an event on first call, null on second
  writeScriptFile(tmp, '.raili/main/trigger.js', `
  let callCount = 0;
  module.exports = async function() {
    callCount++;
    if (callCount === 1) {
      return { eventId: '123' };
    }
    return null;
  };
  `);
  
  // Mock timers and runCommand
  jest.useFakeTimers();
  jest.mock('../src/run');
  const mockRunCommand = require('../src/run').runCommand as jest.Mock;
  mockRunCommand.mockResolvedValue(undefined);
  
  const listenPromise = listenCommand(tmp);
  
  // Advance time to first poll
  jest.advanceTimersByTime(60000);
  
  // Verify runCommand was called with event variables
  expect(mockRunCommand).toHaveBeenCalledWith(
    tmp,
    'clean',
    { eventId: '123' },
    undefined,
    false
  );
  
  // Cleanup to avoid hanging test
  jest.clearAllTimers();
  jest.useRealTimers();
  ```

- **Test case:** "listen exits after 10 minutes of consecutive failures"
  ```typescript
  // Sketch
  const tmp = createTmpWorkspace();
  writeWorkflow(tmp, `initial: start\nstates:\n  start:\n    type: engine`);
  writeAgentRegistry(tmp, {});
  writeScriptRegistry(tmp, {});
  
  // Write trigger.js that always throws
  writeScriptFile(tmp, '.raili/main/trigger.js', `
  module.exports = async function() {
    throw new Error('API down');
  };
  `);
  
  jest.useFakeTimers();
  
  const listenPromise = listenCommand(tmp);
  
  // First poll fails but is within tolerance
  jest.advanceTimersByTime(60000);
  
  // Continue advancing past 10 minutes
  jest.advanceTimersByTime(9 * 60 * 1000);
  
  // Should exit on 11th minute
  jest.advanceTimersByTime(60000);
  
  try {
    await listenPromise;
    fail('Expected to exit with code 1');
  } catch (err) {
    expect((err as Error).message).toMatch(/Polling failed for > 10 minutes/);
  }
  ```

- **Test case:** "listen resets failure timer when trigger succeeds"
  ```typescript
  // Sketch
  const tmp = createTmpWorkspace();
  writeWorkflow(tmp, `
initial: start
states:
  start:
    type: command
    command: "echo ok"
    on:
      PASSED: done
  done:
    type: engine
  `);
  writeAgentRegistry(tmp, {});
  writeScriptRegistry(tmp, {});
  
  // Write trigger that fails then succeeds then fails again
  let triggerCallCount = 0;
  writeScriptFile(tmp, '.raili/main/trigger.js', `
  let count = 0;
  module.exports = async function() {
    count++;
    if (count === 1) throw new Error('fail1');
    if (count === 2) return { id: '1' }; // success resets timer
    if (count === 3) throw new Error('fail2');
    return null;
  };
  `);
  
  jest.useFakeTimers();
  jest.mock('../src/run');
  const mockRunCommand = require('../src/run').runCommand as jest.Mock;
  mockRunCommand.mockResolvedValue(undefined);
  
  const listenPromise = listenCommand(tmp);
  
  // First poll fails
  jest.advanceTimersByTime(60000);
  
  // Second poll succeeds (should reset failure timer)
  jest.advanceTimersByTime(60000);
  expect(mockRunCommand).toHaveBeenCalledWith(tmp, 'clean', { id: '1' }, undefined, false);
  
  // Third poll fails but timer was reset, so still within tolerance
  jest.advanceTimersByTime(60000);
  
  // Should not have exited yet
  jest.clearAllTimers();
  jest.useRealTimers();
  ```

## Acceptance Criteria

- [ ] `raili listen` command is recognized by CLI parser (`RailiCommand.listen`)
- [ ] Command dispatch in `cli.ts` routes to `listenCommand()` with proper error handling
- [ ] Fail-fast: `.raili/` directory validation happens before polling starts
- [ ] Fail-fast: Registry validation happens before polling starts
- [ ] Fail-fast: If `trigger.js` does not exist, command exits immediately with clear error
- [ ] Fail-fast: If `trigger.js` does not export a function, command exits immediately
- [ ] Trigger function is polled every 60 seconds
- [ ] When trigger returns null, polling continues without starting a workflow
- [ ] When trigger returns object, workflow is started with object keys as `--var` flags
- [ ] When trigger returns object, workflow runs in clean mode (`raili run --clean`)
- [ ] After workflow completes, polling resumes (waits 60 seconds, then polls again)
- [ ] When trigger throws error, error is logged to console
- [ ] Failure timer is reset when trigger succeeds (returns null or object)
- [ ] When polling fails for > 10 minutes continuously, command exits with code 1
- [ ] Exit code 0 on successful run (no errors, only clean Ctrl+C exits allowed)
- [ ] Unit tests cover path resolution, module loading, and error cases
- [ ] Integration tests verify polling loop, event handling, and failure timeout
- [ ] Help text updated to document `raili listen [--workflow <name>]`
