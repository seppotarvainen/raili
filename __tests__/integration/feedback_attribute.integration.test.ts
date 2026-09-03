import '../types/copilot-sdk';
import {
  cleanupRailiEnvVars,
  cleanupTmpWorkspace,
  createTmpWorkspace,
  writeAgentFile,
  writeAgentRegistry,
  writeScriptRegistry,
  writeWorkflow,
} from './testUtils';
import { runCommand } from '../../src/run';
import { loadContext } from '../../src/context/context';
import { mockSession, resetCopilotSdkMock } from '@github/copilot-sdk';

jest.mock('@github/copilot-sdk');

let tmpDir: string;

describe('feedback attribute integration', () => {
  beforeEach(() => {
    tmpDir = createTmpWorkspace();
    resetCopilotSdkMock();
  });

  afterEach(() => {
    cleanupTmpWorkspace(tmpDir);
    cleanupRailiEnvVars();
  });

  test('agent with feedback attribute stores feedback but does not change routing', async () => {
    // workflow: agent state returns 'approve' as last line, and also includes feedback in output
    const workflow = `initial: start

states:
  start:
    type: agent
    agent: analyzer
    prompt: "Analyze"
    transitions:
      approve: end

  end:
    type: engine
`;

    writeWorkflow(tmpDir, workflow);
    writeAgentRegistry(tmpDir, { analyzer: { path: '.github/agents/analyzer.md' } });
    writeAgentFile(tmpDir, '.github/agents/analyzer.md', '---\nmodel: test\n---\nAnalyze');
    writeScriptRegistry(tmpDir, {});

    const agentStdout = `Some analysis lines\nFEEDBACK: {"rating":5,"comment":"Looks good"}\napprove\n`;
    mockSession.sendAndWait.mockResolvedValueOnce({
      type: 'assistant.message',
      id: 'event',
      parentId: null,
      timestamp: new Date(0).toISOString(),
      data: { content: agentStdout, messageId: 'message' },
    });

    await runCommand(tmpDir, 'clean', {});

    // context should show end as last state
    const ctx = loadContext(tmpDir);
    expect(ctx.stateHistory[ctx.stateHistory.length - 1].state).toBe('end');
  });
});
