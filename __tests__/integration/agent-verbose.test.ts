/// <reference path="../types/copilot-sdk.d.ts" />
import { runCommand } from '../../src/run';
import { loadContext } from '../../src/context/context';
import { mockSession, resetCopilotSdkMock } from '@github/copilot-sdk';
import {
  cleanupRailiEnvVars,
  cleanupTmpWorkspace,
  createTmpWorkspace,
  writeAgentFile,
  writeAgentRegistry,
  writeScriptRegistry,
  writeWorkflow,
} from './testUtils';

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

describe('agent verbose output', () => {
  it('prints verbose block before agent execution when verbose=true', async () => {
    writeWorkflow(
      tmpDir,
      `
initial: analyze
states:
  analyze:
    type: agent
    agent: test_agent
    prompt: "Analyze the code"
    continue: complete
  complete:
    type: engine
`,
    );
    writeAgentRegistry(tmpDir, { test_agent: { path: './agents/test.agent.md' } });
    writeScriptRegistry(tmpDir, {});
    writeAgentFile(tmpDir, 'agents/test.agent.md', 'Agent instructions');

    // Capture console.log ordering and messages with a monotonic sequence.
    const originalLog = console.log;
    const logs: { t: number; msg: string }[] = [];
    let sequence = 0;
    console.log = (m?: any) => logs.push({ t: ++sequence, msg: String(m) });

    let executionTime = 0;
    mockSession.sendAndWait.mockImplementationOnce(async () => {
      executionTime = ++sequence;
      return {
        type: 'assistant.message',
        id: 'event',
        parentId: null,
        timestamp: new Date(0).toISOString(),
        data: { content: 'analysis\ncomplete', messageId: 'message' },
      };
    });

    try {
      await runCommand(
        tmpDir,
        'clean',
        {},
        undefined,
        false,
        undefined,
        undefined,
        undefined,
        true,
      );
    } finally {
      // restore console
      console.log = originalLog;
    }

    // Ensure verbose block was printed
    const verboseEntry = logs.find((l) => l.msg.includes('VERBOSE: Agent context'));
    expect(verboseEntry).toBeDefined();
    expect(executionTime).toBeGreaterThan(0);
    expect(verboseEntry!.t).toBeLessThan(executionTime);
    expect(mockSession.sendAndWait).toHaveBeenCalled();

    const ctx = loadContext(tmpDir);
    expect(ctx.stateHistory[ctx.stateHistory.length - 1].state).toBe('complete');
  });
});
