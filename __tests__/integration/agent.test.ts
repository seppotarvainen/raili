import '../types/copilot-sdk';
import fs from 'fs';
import path from 'path';
import { runCommand } from '../../src/run';
import { loadContext } from '../../src/context/context';
import { spawn as spawnProcess } from 'child_process';
import { createCancellationController } from '../../src/cancellation';
import {
  cleanupRailiEnvVars,
  cleanupTmpWorkspace,
  createTmpWorkspace,
  fakeChild,
  writeAgentFile,
  writeAgentRegistry,
  writeScriptRegistry,
  writeWorkflow,
} from './testUtils';
import { mockSession, resetCopilotSdkMock, mockClient } from '@github/copilot-sdk';

jest.mock('@github/copilot-sdk');
jest.mock('child_process', () => ({ spawn: jest.fn() }));
const spawn = jest.mocked(spawnProcess);

let tmpDir: string;

beforeEach(() => {
  tmpDir = createTmpWorkspace();
  resetCopilotSdkMock();
  spawn.mockImplementation(() => fakeChild('', '', 0));
});

afterEach(() => {
  cleanupTmpWorkspace(tmpDir);
  cleanupRailiEnvVars();
  spawn.mockReset();
});

// ---------------------------------------------------------------------------
// 1. Agent state with transitions routing (last stdout line)
// ---------------------------------------------------------------------------
describe('agent state with transitions routing', () => {
  it('routes via last stdout line and reaches terminal state', async () => {
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
      data: { content: 'some analysis output\napprove', messageId: 'message' },
    });

    await runCommand(tmpDir, 'clean', {});

    expect(mockSession.sendAndWait).toHaveBeenCalled();

    const ctx = loadContext(tmpDir);
    expect(ctx.stateHistory[ctx.stateHistory.length - 1].state).toBe('done');
  });
});

// New tests: model selection and client cleanup on success
describe('sdk session model selection and cleanup', () => {
  it('creates session with configured model and stops client on completion', async () => {
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
  done:
    type: engine
`,
    );
    writeAgentRegistry(tmpDir, {
      test_agent: { path: './agents/test.agent.md', model: 'test-model' },
    });
    writeScriptRegistry(tmpDir, {});
    writeAgentFile(tmpDir, 'agents/test.agent.md', 'Agent instructions');

    mockSession.sendAndWait.mockResolvedValueOnce({
      type: 'assistant.message',
      id: 'event',
      parentId: null,
      timestamp: new Date(0).toISOString(),
      data: { content: 'analysis result\napprove', messageId: 'message' },
    });

    await runCommand(tmpDir, 'clean', {});

    expect(mockClient.createSession).toHaveBeenCalled();
    const sessionConfig = (mockClient.createSession.mock.calls[0][0] as any) ?? {};
    expect(sessionConfig.model).toBe('test-model');
    expect(mockClient.stop).toHaveBeenCalled();

    const ctx = loadContext(tmpDir);
    expect(ctx.stateHistory[ctx.stateHistory.length - 1].state).toBe('done');
  });
});

describe('agent cancellation', () => {
  it('kills an in-flight agent, persists cancellation metadata, and does not route onward', async () => {
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
  done:
    type: engine
`,
    );
    writeAgentRegistry(tmpDir, { test_agent: { path: './agents/test.agent.md' } });
    writeScriptRegistry(tmpDir, {});
    writeAgentFile(tmpDir, 'agents/test.agent.md', 'Agent instructions');

    const cancellationController = createCancellationController();
    mockSession.sendAndWait.mockImplementationOnce(async () => {
      cancellationController.requestCancellation();
      return undefined;
    });

    const run = runCommand(
      tmpDir,
      'clean',
      {},
      undefined,
      false,
      undefined,
      undefined,
      undefined,
      false,
      cancellationController,
    );
    await run;

    expect(mockSession.sendAndWait).toHaveBeenCalled();
    expect(mockSession.abort).toHaveBeenCalled();
    expect(mockClient.stop).toHaveBeenCalled();
    const ctx = loadContext(tmpDir);
    expect(ctx.stateHistory.map((entry) => entry.state)).not.toContain('done');
    const analyze = ctx.stateHistory.find((entry) => entry.state === 'analyze');
    expect(analyze?.meta?.cancelled).toEqual(expect.any(String));
  });
});

// ---------------------------------------------------------------------------
// 2. Agent state with output storage
// ---------------------------------------------------------------------------
describe('agent state with output storage', () => {
  it('stores agent output to .raili/outputs/<stateId>.md', async () => {
    writeWorkflow(
      tmpDir,
      `
initial: analyze
states:
  analyze:
    type: agent
    agent: test_agent
    prompt: "Analyze the code"
    output:
      store: true
    transitions:
      approve: done
  done:
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
      data: { content: 'analysis complete\napprove', messageId: 'message' },
    });

    await runCommand(tmpDir, 'clean', {});

    // Output file created
    const outputFile = path.join(tmpDir, '.raili', 'main', 'outputs', 'analyze.md');
    expect(fs.existsSync(outputFile)).toBe(true);
    const content = fs.readFileSync(outputFile, 'utf8');
    expect(content).toContain('analysis complete');

    // Terminal state reached
    const ctx = loadContext(tmpDir);
    expect(ctx.stateHistory[ctx.stateHistory.length - 1].state).toBe('done');
  });
});

// ---------------------------------------------------------------------------
// 3. Agent state with variable interpolation in prompt
// ---------------------------------------------------------------------------
describe('agent prompt with variable interpolation', () => {
  it('interpolates ${ticket_id} and sets RAILI_VAR_TICKET_ID', async () => {
    writeWorkflow(
      tmpDir,
      `
initial: analyze
inputs:
  - name: ticket_id
    description: 'Ticket identifier'
states:
  analyze:
    type: agent
    agent: test_agent
    prompt: "Analyze ticket \${ticket_id}"
    transitions:
      done: complete
  complete:
    type: engine
`,
    );
    writeAgentRegistry(tmpDir, { test_agent: { path: './agents/test.agent.md' } });
    writeScriptRegistry(tmpDir, {});
    writeAgentFile(tmpDir, 'agents/test.agent.md', 'Agent instructions');

    let envVarDuringRun: string | undefined;

    mockSession.sendAndWait.mockImplementationOnce(async ({ prompt }) => {
      envVarDuringRun = process.env.RAILI_VAR_TICKET_ID;
      expect(prompt).toContain('Analyze ticket TICKET-123');
      return {
        type: 'assistant.message',
        id: 'event',
        parentId: null,
        timestamp: new Date(0).toISOString(),
        data: { content: 'done', messageId: 'message' },
      };
    });

    await runCommand(tmpDir, 'clean', { ticket_id: 'TICKET-123' });

    expect(envVarDuringRun).toBe('TICKET-123');

    expect(mockSession.sendAndWait).toHaveBeenCalled();

    const ctx = loadContext(tmpDir);
    expect(ctx.stateHistory[ctx.stateHistory.length - 1].state).toBe('complete');
  });
});

// ---------------------------------------------------------------------------
// 4. Agent state with notify hook and approval
// ---------------------------------------------------------------------------
describe('agent state followed by approval', () => {
  it('runs agent, then approval routes to the correct next state', async () => {
    writeWorkflow(
      tmpDir,
      `
initial: analyze
states:
  analyze:
    type: agent
    agent: test_agent
    notify: "echo 'starting analysis'"
    approval:
      question: "Is the analysis correct?"
      PASSED: deploy
      FAILED: redo
  deploy:
    type: engine
  redo:
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
      data: { content: 'agent output here', messageId: 'message' },
    });

    // Accept the approval
    process.env.RAILI_MANUAL_CHOICE = 'PASSED';

    await runCommand(tmpDir, 'clean', {});

    delete process.env.RAILI_MANUAL_CHOICE;

    // Notify was fired (sh -c "echo 'starting analysis'")
    const shCalls = spawn.mock.calls.filter((c: any[]) => c[0] === 'sh');
    const commands = shCalls.map((c: any[]) => c[1][1]);
    expect(commands).toContain("echo 'starting analysis'");

    // Copilot was called
    // Approval routed to deploy
    const ctx = loadContext(tmpDir);
    const states = ctx.stateHistory.map((e) => e.state);
    expect(states).toEqual(['analyze', 'deploy']);
  });
});
