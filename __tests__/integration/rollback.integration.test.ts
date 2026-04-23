import { runCommand } from '../../src/run';
import { loadContext, saveContext } from '../../src/context/context';
import {
  cleanupRailiEnvVars,
  cleanupTmpWorkspace,
  createTmpWorkspace,
  fakeChild,
  writeAgentRegistry,
  writeScriptRegistry,
  writeWorkflow,
} from './testUtils';

jest.mock('child_process', () => ({ spawn: jest.fn() }));
const { spawn } = require('child_process');

let tmpDir: string;

beforeEach(() => {
  tmpDir = createTmpWorkspace();
  spawn.mockImplementation(() => fakeChild('', '', 0));
});

afterEach(() => {
  cleanupTmpWorkspace(tmpDir);
  cleanupRailiEnvVars();
  spawn.mockReset();
});

describe('rollback integration', () => {
  const workflowYaml = `
initial: s1
states:
  s1:
    type: engine
    on:
      PASSED: s2
  s2:
    type: engine
    on:
      PASSED: s3
  s3:
    type: engine
`;

  it('rolls back by numeric count and persists truncated context (preserves vars/approvals/feedbacks)', async () => {
    writeWorkflow(tmpDir, workflowYaml);
    writeAgentRegistry(tmpDir, {});
    writeScriptRegistry(tmpDir, {});

    // Build initial history with a clean run
    await runCommand(tmpDir, 'clean', {});
    let ctx = loadContext(tmpDir);
    expect(ctx.stateHistory.length).toBe(3);
    expect(ctx.stateHistory[ctx.stateHistory.length - 1].state).toBe('s3');

    // Add some persistent context fields and save
    ctx.vars = { ...(ctx.vars || {}), myVar: 'value-123' };
    ctx.approvals = { ...(ctx.approvals || {}), S1_PASSED: 'approved-by-ci' };
    ctx.feedbacks = { ...(ctx.feedbacks || {}), s1: { value: 'initial-feedback' } };
    saveContext(tmpDir, ctx);

    // Continue with rollback by 1, but do not execute further steps (nextSteps=0)
    await runCommand(tmpDir, 'continue', {}, undefined, false, 0, '1');

    ctx = loadContext(tmpDir);
    expect(ctx.stateHistory.length).toBe(2);
    expect(ctx.stateHistory[ctx.stateHistory.length - 1].state).toBe('s2');

    // Ensure vars/approvals/feedbacks survived the rollback
    expect(ctx.vars).toBeDefined();
    expect(ctx.vars!.myVar).toBe('value-123');
    expect(ctx.approvals).toBeDefined();
    expect(ctx.approvals!['S1_PASSED']).toBe('approved-by-ci');
    expect(ctx.feedbacks).toBeDefined();
    expect((ctx.feedbacks! as any).s1).toEqual({ value: 'initial-feedback' });
  });

  it('rolls back to a named state and persists truncated context (preserves vars/approvals/feedbacks)', async () => {
    writeWorkflow(tmpDir, workflowYaml);
    writeAgentRegistry(tmpDir, {});
    writeScriptRegistry(tmpDir, {});

    // Build initial history with a clean run
    await runCommand(tmpDir, 'clean', {});
    let ctx = loadContext(tmpDir);
    expect(ctx.stateHistory.length).toBe(3);

    // Add some persistent context fields and save
    ctx.vars = { ...(ctx.vars || {}), namedVar: 'named-value' };
    ctx.approvals = { ...(ctx.approvals || {}), S2_PASSED: 'ok' };
    ctx.feedbacks = { ...(ctx.feedbacks || {}), s2: { value: 'f2' } };
    saveContext(tmpDir, ctx);

    // Rollback to s1 (named state)
    await runCommand(tmpDir, 'continue', {}, undefined, false, 0, 's1');

    ctx = loadContext(tmpDir);
    expect(ctx.stateHistory.length).toBe(1);
    expect(ctx.stateHistory[0].state).toBe('s1');

    // Ensure vars/approvals/feedbacks survived the rollback
    expect(ctx.vars).toBeDefined();
    expect(ctx.vars!.namedVar).toBe('named-value');
    expect(ctx.approvals).toBeDefined();
    expect(ctx.approvals!['S2_PASSED']).toBe('ok');
    expect(ctx.feedbacks).toBeDefined();
    expect((ctx.feedbacks! as any).s2).toEqual({ value: 'f2' });
  });

  it('throws descriptive error when numeric rollback exceeds history length', async () => {
    writeWorkflow(tmpDir, workflowYaml);
    writeAgentRegistry(tmpDir, {});
    writeScriptRegistry(tmpDir, {});

    await runCommand(tmpDir, 'clean', {});

    await expect(
      runCommand(tmpDir, 'continue', {}, undefined, false, undefined, '10'),
    ).rejects.toThrow('Cannot rollback 10 steps');
  });
});
