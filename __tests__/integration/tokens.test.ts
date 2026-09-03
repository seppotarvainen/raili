import '../types/copilot-sdk';
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

describe('token persistence', () => {
  it('persists token usage into context.json meta.tokens', async () => {
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
      approve: complete
  complete:
    type: engine
`,
    );

    writeAgentRegistry(tmpDir, { test_agent: { path: './agents/test.agent.md' } });
    writeScriptRegistry(tmpDir, {});
    writeAgentFile(tmpDir, 'agents/test.agent.md', 'Agent instructions');

    // Legacy footer text is deliberately ignored; usage comes from the SDK mock.
    const copilotStdout =
      'analysis output\nAI Credits 0.72 (1h 1m 16s)\nTokens ↑ 10 (2 cached) ↓ 5\napprove';

    mockSession.sendAndWait.mockResolvedValueOnce({
      type: 'assistant.message',
      id: 'event',
      parentId: null,
      timestamp: new Date(0).toISOString(),
      data: { content: copilotStdout, messageId: 'message' },
    });

    await runCommand(tmpDir, 'clean', {});

    const ctx = loadContext(tmpDir);
    // Find the state that produced tokens (should be 'analyze')
    const producing = ctx.stateHistory.find((e) => e.state === 'analyze');
    expect(producing).toBeDefined();
    const meta: any = producing!.meta ?? {};
    expect(meta.tokens).toBeDefined();
    const tokens = meta.tokens;
    expect(tokens.ai_display).toBe('AI Credits 2 (2s)');
    expect(tokens.ai_credits).toBeCloseTo(2, 5);
    expect(tokens.ai_time).toBe(2);
    expect(tokens.input).toBe(12);
    expect(tokens.output).toBe(7);
    expect(tokens.cached).toBe(-1);
  });
});
