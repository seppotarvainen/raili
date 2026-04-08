# RAI-68: Make triggers, approval and feedback resolver configurable

**Type:** feature

## Description

Currently trigger polling intervals, timeout values, and retry logic are hardcoded in `src/cli/listen.ts` and resolver handlers. This ticket externalizes these configuration values into a per-workflow `config.json` file, allowing users to customize timing behavior without modifying code. The config file is optional—when absent, sensible defaults are used. When present, all timeouts and intervals become runtime-configurable, supporting diverse deployment scenarios (CI/CD, local development, event-driven systems with varying SLAs).

## Documentation References

- documentation/architecture/resolvers.md (if it exists)
- documentation/usage/listen.md (for trigger polling documentation)

## Code References

- src/cli/listen.ts (hardcoded poll interval and timeout)
- src/handlers/manualHandler.ts (approval/feedback resolution, needs timeout support)
- src/context/pathUtils.ts (resolver path resolution functions)
- src/types.ts (needs ResolverConfig interface)
- src/init.ts (scaffold generation)

## Implementation Plan

1. **src/types.ts** — Add `ResolverConfig` interface with trigger, approval, and feedback timeout/retry fields:
   ```typescript
   export interface ResolverConfig {
     trigger?: {
       interval?: number;        // Poll interval in seconds (default: 15)
       timeout?: number;         // Failure timeout in seconds (default: 3600)
       retry_interval?: number;  // Backoff retry interval in seconds (default: 5)
     };
     approval?: {
       timeout?: number; // Timeout in seconds (default: 3600, no retry)
     };
     feedback?: {
       timeout?: number; // Timeout in seconds (default: 3600)
     };
   }
   ```

2. **src/context/pathUtils.ts** — Add `resolveResolverConfigPath()` function to return path to `.raili/<workflow>/config.json` if it exists, otherwise null (non-fail-fast, defaults are used):
   ```typescript
   export function resolveResolverConfigPath(workflowDir: string): string | null {
     const fs = getFileSystem();
     const p = path.join(workflowDir, 'config.json');
     if (fs.existsSync(p)) {
       return p;
     }
     return null;
   }
   ```

3. **src/config/resolverConfigLoader.ts** (new file) — Create loader with validation:
   - Function `loadResolverConfig(configPath: string | null): ResolverConfig` that:
     - Returns empty object `{}` if path is null
     - Reads JSON file and validates schema
     - Throws on malformed JSON or invalid field types
     - Returns merged config (user values override schema defaults shown in types.ts)
   - Function `getResolverConfigDefaults(): ResolverConfig` returning defaults:
     ```typescript
     {
       trigger: { interval: 15, timeout: 3600, retry_interval: 5 },
       approval: { timeout: 3600 },
       feedback: { timeout: 3600 }
     }
     ```
   - Merge function that overlays user config on defaults

4. **src/cli/listen.ts** — Update `listenCommand()` to:
   - Call `resolveResolverConfigPath(workflowDir)` after workflow dir is resolved
   - Call `loadResolverConfig(configPath)` to get merged config
   - Replace hardcoded `pollIntervalMs = 15_000` with `config.trigger?.interval ?? 15) * 1000`
   - Replace hardcoded `failureTimeoutMs = (10 * 60_000)` with `(config.trigger?.timeout ?? 3600) * 1000`
   - Replace hardcoded backoff `Math.min(5_000, ...)` with `(config.trigger?.retry_interval ?? 5) * 1000`

5. **src/handlers/manualHandler.ts** — Update `handleManualTransition()` and `handleFeedbackPrompt()` signatures to accept optional timeout config:
   - Add `timeoutMs?: number` parameter to both functions
   - Wrap readline/prompt logic in `Promise.race([...], Promise with timeout])` to enforce timeout
   - On timeout, throw error with message: `"Approval prompt timeout exceeded"`

6. **src/init.ts** — Add `generateResolverConfig()` function and update `initCommand()` to scaffold `.raili/<workflow>/config.json`:
   ```typescript
   export function generateResolverConfig(): ResolverConfig {
     return {
       trigger: {
         interval: 15,        // seconds
         timeout: 3600,       // 1 hour
         retry_interval: 5,   // seconds
       },
       approval: {
         timeout: 3600,       // 1 hour
       },
       feedback: {
         timeout: 3600,       // 1 hour
       },
     };
   }
   ```
   Write to `.raili/main/config.json` during init.

7. **src/runner/approveStateRunner.ts** — Update any calls to `handleManualTransition()` to pass approval timeout from resolver config (fetch from context if available)

8. **src/runner/runner.ts** — Check if feedback handler calls need timeout config passed through

## Examples

### Example config.json (in .raili/main/config.json)

```json
{
  "trigger": {
    "interval": 60,
    "timeout": 86400,
    "retry_interval": 10
  },
  "approval": {
    "timeout": 1800
  },
  "feedback": {
    "timeout": 3600
  }
}
```

### Expected behavior

- When `raili listen` runs, it reads `.raili/main/config.json`
- Poll interval becomes 60 seconds instead of 15 seconds
- Trigger failure timeout becomes 24 hours instead of 10 minutes
- Retry backoff becomes 10 seconds instead of 5 seconds
- If config.json is absent, defaults apply (15s poll, 1h failure timeout, 5s backoff)
- If approval config specifies 30min timeout, approval prompts abort after 30 minutes

### console output (listen command with config)

```
$ raili listen
Loaded resolver config from .raili/main/config.json
Trigger poll interval: 60s, failure timeout: 24h, retry: 10s
Polling trigger...
```

## Test Plan

### Unit tests (`__tests__/unit/resolverConfigLoader.test.ts`)

- **Test case:** "loadResolverConfig returns defaults when path is null"
  - Setup: `configPath = null`
  - Act: `const cfg = loadResolverConfig(null)`
  - Assert: `cfg.trigger.interval === 15 && cfg.approval.timeout === 3600`

- **Test case:** "loadResolverConfig reads and validates JSON file"
  - Setup: Write config file with `{ "trigger": { "interval": 120 } }`
  - Act: `const cfg = loadResolverConfig(filePath)`
  - Assert: `cfg.trigger.interval === 120 && cfg.approval.timeout === 3600` (default)

- **Test case:** "loadResolverConfig throws on invalid JSON"
  - Setup: Write malformed JSON
  - Act: `loadResolverConfig(filePath)`
  - Assert: throws error with "Invalid JSON" message

- **Test case:** "loadResolverConfig throws on invalid field types"
  - Setup: Write config with `{ "trigger": { "interval": "not a number" } }`
  - Act: `loadResolverConfig(filePath)`
  - Assert: throws error with "interval must be a number" message

- **Test case:** "getResolverConfigDefaults returns correct defaults"
  - Setup: none
  - Act: `const defaults = getResolverConfigDefaults()`
  - Assert: `defaults.trigger.interval === 15 && defaults.trigger.timeout === 3600`

### Integration tests (`__tests__/integration/listen.config.test.ts`)

Follow the established patterns from `__tests__/integration/testUtils.ts`:

- **Test case:** "listen with config.json uses custom poll interval"

```typescript
// Create temp workspace with config.json
const tmp = createTmpWorkspace();
writeWorkflow(tmp, `initial: start\nstates:\n  start:\n    type: engine\n`);
writeAgentRegistry(tmp, {});
writeScriptRegistry(tmp, {});

// Write config.json with custom interval
const configPath = path.join(tmp, '.raili', 'main', 'config.json');
fs.writeFileSync(configPath, JSON.stringify({
  trigger: { interval: 2, timeout: 10, retry_interval: 1 }
}), 'utf8');

// Write trigger that returns event once then null then throws
writeScriptFile(tmp, '.raili/main/trigger.js', `
let callCount = 0;
module.exports = async function() {
  callCount++;
  if (callCount === 1) return { id: 'evt1' };
  if (callCount === 2) return null;
  throw new Error('done');
};
`);

// Mock setTimeout to capture interval values
const originalSetTimeout = global.setTimeout;
const intervalCalls: number[] = [];
jest.spyOn(global, 'setTimeout').mockImplementation(((cb: any, ms: any) => {
  intervalCalls.push(ms);
  cb();
  return 0 as any;
}) as any);

// Run listen, expect it to throw after polling twice
await expect(listenCommand(tmp)).rejects.toThrow('done');

// Assert interval was 2 seconds (2000ms) not 15 seconds
expect(intervalCalls[0]).toBe(2000);
expect(intervalCalls[1]).toBe(2000); // or 1000 depending on backoff

(global.setTimeout as any) = originalSetTimeout;
```

- **Test case:** "listen without config.json uses default poll interval"
  - Setup: Create temp workspace without config.json
  - Act: Run listenCommand with mocked setTimeout
  - Assert: First setTimeout call is 15000ms (default)

- **Test case:** "approval timeout enforced when configured"
  - Setup: Write config with `approval: { timeout: 1 }` (1 second)
  - Write workflow with approval state
  - Act: Trigger approval, don't respond within 1 second
  - Assert: Approval throws timeout error

## Acceptance Criteria

- [ ] `ResolverConfig` interface added to `types.ts` with all three resolver config blocks (trigger, approval, feedback)
- [ ] `resolveResolverConfigPath()` added to `pathUtils.ts` and returns null when config.json is absent
- [ ] `resolverConfigLoader.ts` created with `loadResolverConfig()` and `getResolverConfigDefaults()` functions
- [ ] `loadResolverConfig()` validates JSON schema and throws on malformed input or invalid types (fail-fast)
- [ ] `listen.ts` updated to load config and use trigger interval, timeout, and retry values (not hardcoded)
- [ ] `handleManualTransition()` and `handleFeedbackPrompt()` accept optional `timeoutMs` parameter and enforce timeout via `Promise.race()`
- [ ] `init.ts` generates `config.json` template during scaffold with sensible defaults
- [ ] `.raili/main/config.json` created by `raili init` with documented defaults
- [ ] All existing integration tests pass (backward compatibility: defaults preserve original behavior)
- [ ] New unit tests pass for config loader with valid/invalid inputs
- [ ] New integration test passes for listen with custom config values
- [ ] Documentation references updated (if applicable) to describe config file and fields
