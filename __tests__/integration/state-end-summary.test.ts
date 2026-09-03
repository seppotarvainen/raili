import '../types/copilot-sdk';
import _fs from 'fs';
import _path from 'path';
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

describe('state end summary is printed', () => {
  it('prints framed end summary after agent state', async () => {
    writeWorkflow(
      tmpDir,
      `
initial: analyze
states:
  analyze:
    type: agent
    agent: test_agent
    prompt: "Analyze the code"
    transitions:
      approve: done
      reject: rework
  done:
    type: engine
  rework:
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
      data: { content: 'analysis output\napprove', messageId: 'message' },
    });

    const spy = jest.spyOn(console, 'log').mockImplementation(() => {});

    await runCommand(tmpDir, 'clean', {});

    spy.mockRestore();

    const ctx = loadContext(tmpDir);
    expect(ctx.stateHistory[ctx.stateHistory.length - 1].state).toBe('done');
  });
});
