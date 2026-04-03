# RAI-62: Add pluggable approval and feedback resolvers

**Type:** feature

## Description

Currently, approval and feedback prompts are hardcoded to CLI prompts using `readline`, which means Raili can only be used interactively at a terminal. This feature enables unattended (server-side) execution by allowing workflows to delegate approval and feedback resolution to pluggable resolver modules. When a resolver exists, it is invoked instead of prompting the CLI; if no resolver is present, behavior falls back to the interactive CLI prompt (backward compatible).

Each resolver is a Node.js module that exports a single async function. Approval resolvers receive state context (question, stateName, vars, and optional output path) and return `'PASSED'` or `'FAILED'`. Feedback resolvers receive the prompt, stateName, and vars and return the feedback string. If a resolver throws, Raili treats it as a hard failure (fail-fast). No workflow.yaml changes are required; resolvers are discovered and loaded automatically.

## Documentation References

- documentation/approval.md
- documentation/states.md
- documentation/variables.md

## Code References

- src/handlers/manualHandler.ts (handleManualTransition, handleFeedbackPrompt)
- src/runner/approveStateRunner.ts (runApprovalStep)
- src/runner/runner.ts (handleApproval, handleFeedback)
- src/types.ts (ApprovalConfig, FeedbackConfig, StateConfig)
- src/init.ts (init template)
- src/context/pathUtils.ts (resolver path resolution)

## Implementation Plan

1. **src/context/pathUtils.ts** — Add new functions to resolve resolver paths:
   - `resolveApprovalResolverPath(workflowDir: string): string | null` — Returns path to `.raili/<workflow>/approval-resolver.js` or null if not found
   - `resolveFeedbackResolverPath(workflowDir: string): string | null` — Returns path to `.raili/<workflow>/feedback-resolver.js` or null if not found

2. **src/handlers/manualHandler.ts** — Add resolver support:
   - Create new interface `ApprovalResolverInput = { question: string; stateName: string; vars?: Record<string, string>; outputPath?: string | null }`
   - Create new interface `ApprovalResolverFunction = (input: ApprovalResolverInput) => Promise<'PASSED' | 'FAILED'>`
   - Create new interface `FeedbackResolverInput = { prompt: string; stateName: string; vars?: Record<string, string> }`
   - Create new interface `FeedbackResolverFunction = (input: FeedbackResolverInput) => Promise<string>`
   - Add new function `loadApprovalResolver(resolverPath: string): ApprovalResolverFunction | null` — Dynamically require the resolver module and export its async function. If path is null/missing, return null. If resolver doesn't export a function, throw immediately (fail-fast).
   - Add new function `loadFeedbackResolver(resolverPath: string): FeedbackResolverFunction | null` — Same pattern as approval resolver.
   - Add new function `executeApprovalResolver(resolver: ApprovalResolverFunction, input: ApprovalResolverInput): Promise<'PASSED' | 'FAILED'>` — Call the resolver function; if it throws, re-throw as fail-fast error.
   - Add new function `executeFeedbackResolver(resolver: FeedbackResolverFunction, input: FeedbackResolverInput): Promise<string>` — Call the resolver function; if it throws, re-throw as fail-fast error.
   - Update `handleManualTransition()` to accept an optional `approvalResolver?: ApprovalResolverFunction` parameter. If provided, call `executeApprovalResolver()` instead of prompting the CLI.
   - Update `handleFeedbackPrompt()` to accept an optional `feedbackResolver?: FeedbackResolverFunction` parameter. If provided, call `executeFeedbackResolver()` instead of prompting the CLI.
   - Both functions must preserve backward compatibility: if no resolver is provided, use interactive CLI prompts as before.

3. **src/runner/approveStateRunner.ts** — Integrate approval resolver:
   - Add parameter `approvalResolverPath?: string | null` to `runApprovalStep()` signature.
   - At the start of `runApprovalStep()`, load the resolver using `loadApprovalResolver(approvalResolverPath)` (returns null if path is null/missing).
   - Pass the loaded resolver to `handleManualTransition()` as an optional parameter.
   - No workflow.yaml config changes needed; the resolver is discovered by file presence only.

4. **src/runner/runner.ts** — Wire resolvers into the execution flow:
   - Update the `run()` method to resolve both approval and feedback resolver paths before entering the execution loop. Use `resolveApprovalResolverPath()` and `resolveFeedbackResolverPath()` from pathUtils.
   - Pass the resolved paths to `runApprovalStep()` when `handleApproval()` is called.
   - Pass the resolved feedback resolver path to `handleFeedbackPrompt()` when `handleFeedback()` is called.

5. **src/runner/stateRunnerUtils.ts** (if needed) — Ensure export path is accessible:
   - Verify that `outputPath` (the path to stored outputs, if any) is properly resolved and available during resolver execution. The approval resolver may need to read the previous output to make decisions. This may already be available in the runner context; confirm and document where the path comes from.

6. **src/init.ts** — Add template examples:
   - Add inline comments to the template workflow.yaml explaining that optional `.raili/main/approval-resolver.js` and `.raili/main/feedback-resolver.js` can be created for unattended execution.
   - (Optional) Create example resolver templates in `.raili/main/` if the user wants to scaffold examples. For now, just document it in the workflow template comments.

## Examples

### Approval resolver structure

**File:** `.raili/main/approval-resolver.js`

```javascript
module.exports = async function approvalResolver(input) {
  // input = { question, stateName, vars, outputPath }
  // Read from external source, call API, check file, etc.
  // Return 'PASSED' or 'FAILED'
  
  console.log(`Approval for state '${input.stateName}': ${input.question}`);
  
  // Example: fetch decision from a file
  const fs = require('fs');
  const decision = fs.readFileSync('/tmp/approval-decision.txt', 'utf8').trim();
  
  if (decision === 'approve') {
    return 'PASSED';
  } else {
    return 'FAILED';
  }
};
```

### Feedback resolver structure

**File:** `.raili/main/feedback-resolver.js`

```javascript
module.exports = async function feedbackResolver(input) {
  // input = { prompt, stateName, vars }
  // Collect feedback from external source
  // Return feedback string
  
  console.log(`Feedback for state '${input.stateName}': ${input.prompt}`);
  
  // Example: read from Slack or Jira comment
  const feedback = 'Feedback from external system';
  return feedback;
};
```

### Expected behavior without resolvers (backward compatible)

```yaml
states:
  review:
    type: engine
    approval:
      question: "Does this look good?"
      PASSED: merge
      FAILED: rework
```

**CLI execution (existing behavior):**
```
❯ raili run
...
Approval for state 'review': Does this look good?
[Enter = PASSED, type reason = FAILED]: <user types here>
```

**Server execution with resolver (new behavior):**
```bash
# Create resolver
cat > .raili/main/approval-resolver.js << 'EOF'
module.exports = async (input) => {
  const approved = await checkWithExternalSystem(input.question);
  return approved ? 'PASSED' : 'FAILED';
};
EOF

# Run unattended
raili run
# No prompt shown; resolver is called automatically
# Workflow continues based on resolver's decision
```

### Resolver invocation signature

**Approval Resolver:**
```typescript
// Called as:
const result = await approvalResolver({
  question: "Does this look good?",
  stateName: "review",
  vars: { ticket_id: "TKT-123", author: "alice" },
  outputPath: ".raili/main/outputs/review.md" // or null if output.store: false
});
// Returns: 'PASSED' or 'FAILED'
```

**Feedback Resolver:**
```typescript
// Called as:
const feedback = await feedbackResolver({
  prompt: "Enter your review notes:",
  stateName: "review",
  vars: { ticket_id: "TKT-123" }
});
// Returns: feedback string (e.g., "LGTM, approved by reviewer")
```

## Test Plan

### Unit tests (`__tests__/unit/`)

- **File:** `__tests__/unit/manualHandler.test.ts`
- **Test case:** "Loads and executes approval resolver when present"
  - Setup: Mock `require()` to return a resolver function that returns `'PASSED'`
  - Act: Call `loadApprovalResolver(path)` then `executeApprovalResolver(resolver, { question, stateName, vars, outputPath })`
  - Assert: Resolver is called with correct input and returns `'PASSED'`

- **Test case:** "Falls back to CLI prompt when approval resolver is null"
  - Setup: Create mock handleManualTransition; call with `approvalResolver: undefined`
  - Act: handleManualTransition is called normally
  - Assert: CLI prompt is invoked (readline interface is created)

- **Test case:** "Throws fail-fast if approval resolver throws"
  - Setup: Mock resolver to throw new Error('Custom error')
  - Act: Call `executeApprovalResolver()` with failing resolver
  - Assert: Error is propagated immediately (not caught)

- **File:** `__tests__/unit/manualHandler.test.ts` (continued)
- **Test case:** "Loads and executes feedback resolver when present"
  - Setup: Mock resolver to return feedback string `'Great work!'`
  - Act: Call `loadFeedbackResolver(path)` then `executeFeedbackResolver(resolver, { prompt, stateName, vars })`
  - Assert: Resolver is called and returns feedback string

- **Test case:** "Fails fast if feedback resolver throws"
  - Setup: Mock resolver to throw
  - Act: Call `executeFeedbackResolver()`
  - Assert: Error is propagated immediately

- **File:** `__tests__/unit/approveStateRunner.test.ts`
- **Test case:** "Passes approval resolver path to runApprovalStep"
  - Setup: Mock `loadApprovalResolver()` to return a resolver
  - Act: Call `runApprovalStep(stateId, approval, { cwd, context }, resolverPath)`
  - Assert: Resolver is passed to `handleManualTransition()`

- **File:** `__tests__/unit/pathUtils.test.ts` (or new file)
- **Test case:** "Returns approval resolver path if file exists"
  - Setup: Create temp dir with `.raili/main/approval-resolver.js`
  - Act: Call `resolveApprovalResolverPath(workflowDir)`
  - Assert: Returns absolute path to file

- **Test case:** "Returns null if approval resolver doesn't exist"
  - Setup: Create temp dir without resolver file
  - Act: Call `resolveApprovalResolverPath(workflowDir)`
  - Assert: Returns null

### Integration tests (`__tests__/integration/`)

Follow the established patterns from `__tests__/integration/testUtils.ts`:

- **File:** `__tests__/integration/approval-resolver.integration.test.ts`
- **Test case:** "Approval resolver is called and routes to PASSED state"
  - Setup: Create temp workspace, write workflow with approval state, write approval resolver that always returns PASSED
  - Workflow:
    ```yaml
    initial: check
    states:
      check:
        type: engine
        approval:
          question: "Approve?"
          PASSED: done
          FAILED: reject
      done:
        type: engine
      reject:
        type: engine
    ```
  - Resolver: `module.exports = async (input) => 'PASSED';`
  - Mock: `spawn.mockImplementation(() => fakeChild('', '', 0));`
  - Act: `await runCommand(tmp, 'clean', {});`
  - Assert: Approval state enters, resolver returns PASSED, workflow routes to done state
    ```typescript
    const ctx = loadContext(tmp);
    const lastEntry = ctx.stateHistory[ctx.stateHistory.length - 1];
    expect(lastEntry.state).toBe('done'); // or check approval meta
    ```

- **Test case:** "Approval resolver is called and routes to FAILED state"
  - Setup: Similar to above, but resolver returns 'FAILED'
  - Act: `await runCommand(tmp, 'clean', {});`
  - Assert: Workflow routes to reject state

- **Test case:** "Approval resolver fails (throws), workflow stops with error"
  - Setup: Resolver throws `new Error('External API down')`
  - Act: `await runCommand(tmp, 'clean', {})`
  - Assert: Command throws error containing 'External API down'

- **Test case:** "Falls back to CLI prompt when approval resolver doesn't exist"
  - Setup: Workflow with approval, no resolver file created
  - Mock: Mock `handleManualTransition` to return PASSED via env var override (`RAILI_MANUAL_CHOICE='PASSED'`)
  - Act: `await runCommand(tmp, 'clean', {})`
  - Assert: Workflow proceeds normally using CLI fallback (or env override)

- **File:** `__tests__/integration/feedback-resolver.integration.test.ts`
- **Test case:** "Feedback resolver is called and captures feedback"
  - Setup: Create workflow with feedback state, write feedback resolver that returns feedback string
  - Workflow:
    ```yaml
    initial: ask
    states:
      ask:
        type: engine
        feedback:
          expose_var: review
      done:
        type: engine
    ```
  - Resolver: `module.exports = async (input) => 'Looks good!';`
  - Act: `await runCommand(tmp, 'clean', {});`
  - Assert: Feedback is captured and exposed as variable `review`
    ```typescript
    const ctx = loadContext(tmp);
    expect(ctx.vars.review).toBe('Looks good!');
    ```

- **Test case:** "Feedback resolver fails (throws), workflow stops with error"
  - Setup: Resolver throws
  - Act: `await runCommand(tmp, 'clean', {})`
  - Assert: Command throws error immediately (fail-fast)

- **Test case:** "Both resolvers can be used on the same state"
  - Setup: State with both `approval` and `feedback`
  - Resolvers: Approval resolver returns PASSED, feedback resolver returns feedback string
  - Act: `await runCommand(tmp, 'clean', {})`
  - Assert: Both resolvers are called, results are captured, context.vars contains both

## Acceptance Criteria

- [ ] Approval resolver discovery: If `.raili/<workflow>/approval-resolver.js` exists, it is loaded and used instead of CLI prompt
- [ ] Feedback resolver discovery: If `.raili/<workflow>/feedback-resolver.js` exists, it is loaded and used instead of CLI prompt
- [ ] Resolver input contract: Approval resolvers receive `{ question, stateName, vars, outputPath }` and return `'PASSED'` or `'FAILED'`
- [ ] Resolver input contract: Feedback resolvers receive `{ prompt, stateName, vars }` and return a string
- [ ] Fail-fast: If a resolver throws an error, Raili stops immediately (does not catch or retry)
- [ ] Backward compatibility: If no resolver file exists, CLI prompt is used as before (no breaking changes)
- [ ] No workflow.yaml changes required: Resolver activation happens by file presence only; no new YAML keys added
- [ ] Unit tests pass: All resolver loading, execution, and fallback logic is tested with mocks (no real resolvers executed)
- [ ] Integration tests pass: End-to-end workflows exercise resolver calling, error handling, and variable capture
- [ ] Documentation updated: approval.md mentions resolver option as alternative to CLI prompts, with example resolver code
