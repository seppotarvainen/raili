/// <reference path="../types/copilot-sdk.d.ts" />
import { runCommand } from '../../src/run';
import { loadContext } from '../../src/context/context';
import {
  cleanupRailiEnvVars,
  cleanupTmpWorkspace,
  createTmpWorkspace,
  writeAgentFile,
  writeAgentRegistry,
  writeScriptRegistry,
  writeWorkflow,
  writeNamedWorkflow,
} from './testUtils';
import { mockSession, resetCopilotSdkMock } from '@github/copilot-sdk';

jest.mock('@github/copilot-sdk');

let tmpDir: string;

beforeEach(() => {
  tmpDir = createTmpWorkspace();
  resetCopilotSdkMock();
});

afterEach(() => {
  cleanupTmpWorkspace(tmpDir);
  cleanupRailiEnvVars();
});

describe('workflow variable in agent prompts', () => {
  it('injects workflow var into agent prompt for default workflow', async () => {
    writeWorkflow(
      tmpDir,
      `
initial: analyze
states:
  analyze:
    type: agent
    agent: test_agent
    prompt: "Analyze workflow \${workflow}"
    transitions:
      done: complete
  complete:
    type: engine
`,
    );

    writeAgentRegistry(tmpDir, { test_agent: { path: './agents/test.agent.md' } });
    writeScriptRegistry(tmpDir, {});
    writeAgentFile(tmpDir, 'agents/test.agent.md', 'Agent instructions');

    mockSession.sendAndWait.mockResolvedValueOnce({
      type: 'assistant.message',
      id: 'event',
      parentId: null,
      timestamp: new Date(0).toISOString(),
      data: { content: 'done', messageId: 'message' },
    });

    await runCommand(tmpDir, 'clean', {});

    const ctx = loadContext(tmpDir);
    expect(ctx.vars!.workflow).toBe('main');

    expect(mockSession.sendAndWait.mock.calls[0][0].prompt).toContain('main');
  });

  it('injects workflow var into agent prompt for named workflow', async () => {
    writeNamedWorkflow(
      tmpDir,
      'dev',
      `
initial: analyze
states:
  analyze:
    type: agent
    agent: test_agent
    prompt: "Analyze workflow \${workflow}"
    transitions:
      done: complete
  complete:
    type: engine
`,
    );

    writeAgentRegistry(tmpDir, { test_agent: { path: './agents/test.agent.md' } });
    writeScriptRegistry(tmpDir, {});
    writeAgentFile(tmpDir, 'agents/test.agent.md', 'Agent instructions');

    mockSession.sendAndWait.mockResolvedValueOnce({
      type: 'assistant.message',
      id: 'event',
      parentId: null,
      timestamp: new Date(0).toISOString(),
      data: { content: 'done', messageId: 'message' },
    });

    await runCommand(tmpDir, 'clean', {}, 'dev');

    const ctx = loadContext(tmpDir, 'dev');
    expect(ctx.vars!.workflow).toBe('dev');

    expect(mockSession.sendAndWait.mock.calls[0][0].prompt).toContain('dev');
  });

  it('preserves workflow var on continue runs', async () => {
    writeWorkflow(
      tmpDir,
      `
initial: analyze
states:
  analyze:
    type: agent
    agent: test_agent
    prompt: "Analyze workflow \${workflow}"
    transitions:
      done: complete
  complete:
    type: engine
`,
    );

    writeAgentRegistry(tmpDir, { test_agent: { path: './agents/test.agent.md' } });
    writeScriptRegistry(tmpDir, {});
    writeAgentFile(tmpDir, 'agents/test.agent.md', 'Agent instructions');

    mockSession.sendAndWait.mockResolvedValueOnce({
      type: 'assistant.message',
      id: 'event',
      parentId: null,
      timestamp: new Date(0).toISOString(),
      data: { content: 'done', messageId: 'message' },
    });

    // initial clean run
    await runCommand(tmpDir, 'clean', {});
    let ctx = loadContext(tmpDir);
    expect(ctx.vars!.workflow).toBe('main');

    // continue run should preserve existing workflow var
    mockSession.sendAndWait.mockResolvedValueOnce({
      type: 'assistant.message',
      id: 'event',
      parentId: null,
      timestamp: new Date(0).toISOString(),
      data: { content: 'done', messageId: 'message' },
    });

    await runCommand(tmpDir, 'continue', {});
    ctx = loadContext(tmpDir);
    expect(ctx.vars!.workflow).toBe('main');
  });
});
