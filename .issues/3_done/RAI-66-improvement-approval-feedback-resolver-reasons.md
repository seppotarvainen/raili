# RAI-66: Add failure reason to approval and feedback resolvers

**Type:** improvement

## Description

Approval and feedback resolvers currently have asymmetric return type contracts compared to the manual handler in `manualHandler.ts`. The manual handler captures and persists both the chosen outcome AND the reason text (e.g., why an approval was rejected). However, external resolver functions (`approval-resolver.js` and `feedback-resolver.js`) return only the outcome string (`PASSED` or `FAILED` for approvals; plain string for feedback), losing the context about why a decision was made.

This prevents next states from accessing rejection reasons or feedback context, reducing traceability and automation capabilities. The system should enable resolvers to return structured responses with optional reasons, matching the manual handler's capability.

## Documentation References

- documentation/approval.md (Pluggable Approval & Feedback Resolvers section)

## Code References

- src/handlers/manualHandler.ts (ManualResult, FeedbackResolverFunction, ApprovalResolverFunction)
- src/runner/approveStateRunner.ts (runApprovalStep, ApprovalOutcome)
- src/runner/feedbackStateRunner.ts (runFeedbackStep, FeedbackOutcome)
- src/types.ts (ApprovalResolverFn, FeedbackResolverFn type definitions)
- __tests__/unit/handlers/manualHandler.resolvers.test.ts
- __tests__/integration/approval-resolver.integration.test.ts
- __tests__/integration/approval-resolver-failure.integration.test.ts
- __tests__/integration/feedback-resolver.integration.test.ts

## Implementation Plan

### 1. Update type definitions in `src/types.ts`

- Change `ApprovalResolverFn` to return `Promise<{ outcome: 'PASSED' | 'FAILED'; reason?: string }>` instead of `Promise<'PASSED' | 'FAILED'>`
- Change `FeedbackResolverFn` to return `Promise<{ feedback: string; metadata?: string }>` instead of `Promise<string>`
- Update inline JSDoc examples to show the new shape

### 2. Update `src/handlers/manualHandler.ts`

- Update `ApprovalResolverFunction` type to return `{ outcome: 'PASSED' | 'FAILED'; reason?: string }`
- Update `FeedbackResolverFunction` type to return `{ feedback: string; metadata?: string }`
- Modify `executeApprovalResolver()` to validate the new object shape: check `outcome` property and optional `reason`
- Modify `executeFeedbackResolver()` to validate the new object shape: check `feedback` property (required, non-empty string) and optional `metadata`
- Update `handleManualTransition()` to extract `reason` from the resolver result object when present
- Update `handleFeedbackPrompt()` to extract `feedback` and `metadata` from the resolver result object

### 3. Update `src/runner/approveStateRunner.ts`

- Modify `runApprovalStep()` to extract `reason` from the resolver execution result
- Ensure `reason` is properly returned in the `ApprovalOutcome` (already present in the interface)
- The reason should be persisted to context via approval metadata

### 4. Update `src/runner/feedbackStateRunner.ts`

- Modify `runFeedbackStep()` to extract `feedback` and `metadata` from the resolver execution result
- Return both `feedback` and `metadata` in the feedback outcome
- Ensure `metadata` is persisted to context (if the feedback config has a `store_metadata` option, or similar)

### 5. Backward compatibility handling

- Resolver functions may return either the old format (plain string) or the new format (object)
- In `executeApprovalResolver()`: if the result is a plain string (`PASSED` or `FAILED`), treat it as `{ outcome: result, reason: undefined }`
- In `executeFeedbackResolver()`: if the result is a plain string, treat it as `{ feedback: result, metadata: undefined }`
- This ensures existing resolvers continue to work without modification

### 6. Update unit tests in `__tests__/unit/handlers/manualHandler.resolvers.test.ts`

- Add test cases for new object-based return formats
- Add test cases for backward compatibility (plain string returns)
- Add test for optional `reason` field on approvals
- Add test for optional `metadata` field on feedback
- Add validation test: resolver returns object without required `outcome` → error
- Add validation test: resolver returns object with invalid `outcome` → error
- Add validation test: feedback resolver returns object without `feedback` → error

### 7. Update integration tests

- **approval-resolver.integration.test.ts**: Add test case where resolver returns `{ outcome: 'PASSED', reason: 'Looks good' }` and verify reason is persisted to context
- **approval-resolver-failure.integration.test.ts**: Add test case where resolver returns `{ outcome: 'FAILED', reason: 'Does not meet requirements' }` and verify reason is persisted under `context.approvals` and `context.vars`
- **feedback-resolver.integration.test.ts**: Add test case where resolver returns `{ feedback: 'My thoughts', metadata: 'auto-generated' }` and verify both are accessible

### 8. Update documentation in `documentation/approval.md`

- Update the "Pluggable Approval & Feedback Resolvers" section to show both old (string) and new (object) return formats
- Clarify that `reason` is optional and defaults to empty string if omitted
- Clarify that `metadata` on feedback is optional
- Show examples of structured returns with reasons

## Examples

### New approval resolver with reason

```js
module.exports = async function (input) {
  // input.question, input.stateName, input.vars, input.outputPath
  
  if (someCondition) {
    return { outcome: 'PASSED', reason: 'All checks passed' };
  } else {
    return { outcome: 'FAILED', reason: 'Security audit failed' };
  }
};
```

### Backward-compatible approval resolver (still works)

```js
module.exports = async function (input) {
  return 'PASSED'; // Works — treated as { outcome: 'PASSED', reason: undefined }
};
```

### New feedback resolver with metadata

```js
module.exports = async function (input) {
  const feedback = await fetchFromExternalService();
  return {
    feedback: feedback.text,
    metadata: `source=api, timestamp=${Date.now()}`
  };
};
```

### Context structure after resolver with reason

```json
{
  "stateHistory": [
    {
      "state": "review",
      "enteredAt": "2026-03-13T08:16:30Z",
      "meta": {
        "approval": {
          "question": "Approve changes?",
          "chosen": "FAILED",
          "reason": "Security audit failed"
        }
      }
    }
  ],
  "approvals": {
    "REVIEW_FAILED": "Security audit failed"
  },
  "vars": {
    "REVIEW_FAILED": "Security audit failed"
  }
}
```

## Test Plan

### Unit tests (`__tests__/unit/handlers/manualHandler.resolvers.test.ts`)

**Test case:** "executeApprovalResolver accepts new object format with reason"
```typescript
// Setup: Create resolver that returns { outcome: 'FAILED', reason: 'Not ready' }
const resolver = async () => ({ outcome: 'FAILED' as const, reason: 'Not ready' });

// Act
const out = await executeApprovalResolver(resolver as any, { question: 'q', stateName: 's' });

// Assert
expect(out).toEqual({ outcome: 'FAILED', reason: 'Not ready' });
```

**Test case:** "executeApprovalResolver maintains backward compatibility with string return"
```typescript
// Setup: Create resolver that returns plain string
const resolver = async () => 'PASSED';

// Act
const out = await executeApprovalResolver(resolver as any, { question: 'q', stateName: 's' });

// Assert
expect(out).toEqual({ outcome: 'PASSED', reason: undefined });
```

**Test case:** "executeApprovalResolver throws when object lacks outcome property"
```typescript
// Setup
const resolver = async () => ({ reason: 'oops' });

// Act & Assert
await expect(executeApprovalResolver(resolver as any, { question: 'q', stateName: 's' }))
  .rejects.toThrow(/outcome.*required/);
```

**Test case:** "executeFeedbackResolver accepts new object format with feedback and metadata"
```typescript
// Setup
const resolver = async () => ({ feedback: 'Good work', metadata: 'auto-approved' });

// Act
const out = await executeFeedbackResolver(resolver as any, { prompt: 'p', stateName: 's' });

// Assert
expect(out).toEqual({ feedback: 'Good work', metadata: 'auto-approved' });
```

**Test case:** "executeFeedbackResolver maintains backward compatibility with string return"
```typescript
// Setup
const resolver = async () => 'Looks good';

// Act
const out = await executeFeedbackResolver(resolver as any, { prompt: 'p', stateName: 's' });

// Assert
expect(out).toEqual({ feedback: 'Looks good', metadata: undefined });
```

**Test case:** "executeFeedbackResolver throws when object lacks feedback property"
```typescript
// Setup
const resolver = async () => ({ metadata: 'x' });

// Act & Assert
await expect(executeFeedbackResolver(resolver as any, { prompt: 'p', stateName: 's' }))
  .rejects.toThrow(/feedback.*required/);
```

**Test case:** "executeFeedbackResolver throws when feedback is empty string"
```typescript
// Setup
const resolver = async () => ({ feedback: '' });

// Act & Assert
await expect(executeFeedbackResolver(resolver as any, { prompt: 'p', stateName: 's' }))
  .rejects.toThrow(/feedback.*empty/);
```

**Test case:** "handleManualTransition extracts reason from object-format resolver"
```typescript
// Setup
const cfg = { question: 'Ok?', options: { PASSED: 'x', FAILED: 'y' } } as any;
const resolver = async () => ({ outcome: 'FAILED', reason: 'Not ready' });

// Act
const res = await handleManualTransition(cfg, resolver as any);

// Assert
expect(res.chosen).toBe('FAILED');
expect(res.reason).toBe('Not ready');
```

### Integration tests (`__tests__/integration/`)

**Test case:** "approval resolver returns reason and reason is persisted to context.approvals"

```typescript
// Sketch: Create workflow with approval, write resolver that returns { outcome: 'FAILED', reason: 'Security check failed' }
writeWorkflow(tmp, `
initial: start
states:
  start:
    type: engine
    approval:
      question: "Approve?"
      PASSED: done
      FAILED: rework
  rework:
    type: engine
  done:
    type: engine
`);

writeAgentRegistry(tmp, {});
writeScriptRegistry(tmp, {});
writeSubWorkflow(tmp, 'main', 'approval-resolver.js', `
  module.exports = async function (input) {
    return { outcome: 'FAILED', reason: 'Security check failed' };
  };
`);

// Act
await runCommand(tmp, 'clean', {});

// Assert
const ctx = loadContext(tmp);
expect(ctx.stateHistory[0].state).toBe('start');
expect(ctx.stateHistory[0].meta.approval.reason).toBe('Security check failed');
expect(ctx.approvals['START_FAILED']).toBe('Security check failed');
expect(ctx.vars['START_FAILED']).toBe('Security check failed');
```

**Test case:** "approval resolver backward compatibility — string return still works"

```typescript
// Similar setup but resolver returns just 'PASSED' string
writeSubWorkflow(tmp, 'main', 'approval-resolver.js', `
  module.exports = async function (input) { return 'PASSED'; };
`);

// Act
await runCommand(tmp, 'clean', {});

// Assert
const ctx = loadContext(tmp);
const finalState = ctx.stateHistory[ctx.stateHistory.length - 1].state;
expect(finalState).toBe('done');
```

**Test case:** "feedback resolver returns feedback and metadata, both accessible in next states"

```typescript
// Workflow with feedback that returns metadata
writeWorkflow(tmp, `
initial: start
states:
  start:
    type: engine
    feedback:
      expose_var: feedback_notes
      question: "Feedback?"
  done:
    type: engine
`);

writeSubWorkflow(tmp, 'main', 'feedback-resolver.js', `
  module.exports = async function (input) {
    return {
      feedback: 'Looks good overall',
      metadata: 'automated=true,version=2'
    };
  };
`);

// Act
await runCommand(tmp, 'clean', {});

// Assert
const ctx = loadContext(tmp);
expect(ctx.vars.feedback_notes).toBe('Looks good overall');
// metadata should be stored somewhere accessible (if applicable)
```

## Acceptance Criteria

- [ ] Approval resolvers can return `{ outcome: 'PASSED' | 'FAILED', reason?: string }` and reason is persisted to context
- [ ] Feedback resolvers can return `{ feedback: string; metadata?: string }` and both are accessible in context
- [ ] Backward compatibility: old resolvers returning plain strings still work without modification
- [ ] Missing required fields (e.g., `outcome`, `feedback`) cause immediate fail-fast error with clear message
- [ ] Reasons are persisted to both `context.approvals[<STATE>_<OUTCOME>]` and `context.vars[<STATE>_<OUTCOME>]` for environment access
- [ ] All existing unit tests pass
- [ ] All existing integration tests pass
- [ ] New unit tests cover object format, backward compat, and validation errors
- [ ] New integration tests verify reason/metadata persistence to context and environment variables
- [ ] Documentation updated with examples of new format and backward-compat note
