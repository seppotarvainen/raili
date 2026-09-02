import fs from 'fs';
import path from 'path';
import { runCommand } from '../../src/run';
import {
  cleanupRailiEnvVars,
  cleanupTmpWorkspace,
  createTmpWorkspace,
  fakeChild,
  writeAgentFile,
  writeAgentRegistry,
  writeScriptRegistry,
  writeNamedWorkflow,
} from './testUtils';
import { mockSession, resetCopilotSdkMock } from '@github/copilot-sdk';

jest.mock('@github/copilot-sdk');
jest.mock('child_process', () => ({ spawn: jest.fn() }));
const { spawn } = require('child_process');

let tmpDir: string;

beforeEach(() => {
  tmpDir = createTmpWorkspace();
  resetCopilotSdkMock();
  (spawn as jest.Mock).mockImplementation(() => fakeChild('', '', 0));
});

afterEach(() => {
  cleanupTmpWorkspace(tmpDir);
  cleanupRailiEnvVars();
  (spawn as jest.Mock).mockReset();
});

describe('integration: global and workflow-scoped learnings', () => {
  it('writes learnings to global .raili/learnings by default', async () => {
    writeNamedWorkflow(
      tmpDir,
      'main',
      `initial: produce
states:
  produce:
    type: command
    command: |
      echo "Prelude text
      LESSON: Global lesson from produce
      Extra"
    output:
      store: true
    teach:
      agent1:
        - output: produce
    on:
      PASSED: analyze
  analyze:
    type: agent
    agent: agent1
    prompt: "Review"
    transitions:
      done: done
  done:
    type: engine
`,
    );

    writeAgentRegistry(tmpDir, { agent1: { path: './agents/agent1.md' } });
    writeScriptRegistry(tmpDir, {});
    writeAgentFile(tmpDir, 'agents/agent1.md', 'Agent instructions');

    (spawn as jest.Mock).mockImplementation((cmd: string, args?: any[], opts?: any) => {
      if (cmd === 'sh' && Array.isArray(args) && typeof args[1] === 'string') {
        const invoked = args[1] as string;
        if (invoked.includes('echo')) {
          return fakeChild('Prelude text\nLESSON: Global lesson from produce\nExtra\n', '', 0);
        }
      }
      return fakeChild('', '', 0);
    });
    mockSession.sendAndWait.mockResolvedValue({
      type: 'assistant.message',
      id: 'learning-output',
      parentId: null,
      timestamp: new Date(0).toISOString(),
      data: { content: 'done', messageId: 'message' },
    });

    await runCommand(tmpDir, 'clean', {});

    const globalLearnings = path.join(tmpDir, '.raili', 'learnings', 'agent1.md');
    const workflowLearnings = path.join(tmpDir, '.raili', 'main', 'learnings', 'agent1.md');

    expect(fs.existsSync(globalLearnings)).toBe(true);
    const content = fs.readFileSync(globalLearnings, 'utf8');
    expect(content).toContain('Global lesson from produce');

    // Ensure workflow-local file was not written
    expect(fs.existsSync(workflowLearnings)).toBe(false);
  });

  it('injects merged learnings (global + workflow) into agent prompt across workflows', async () => {
    // Pre-populate a global learnings file
    const globalDir = path.join(tmpDir, '.raili', 'learnings');
    fs.mkdirSync(globalDir, { recursive: true });
    fs.writeFileSync(
      path.join(globalDir, 'agent2.md'),
      '- [2024-01-01T00:00:00Z] [manual] Global: remember this\n',
      'utf8',
    );

    // Create a distinct workflow 'qa' that uses the same agent
    writeNamedWorkflow(
      tmpDir,
      'qa',
      `initial: analyze
states:
  analyze:
    type: agent
    agent: agent2
    prompt: "QA run"
    transitions:
      done: done
  done:
    type: engine
`,
    );

    writeAgentRegistry(tmpDir, { agent2: { path: './agents/agent2.md' } });
    writeScriptRegistry(tmpDir, {});
    writeAgentFile(tmpDir, 'agents/agent2.md', 'Agent 2');

    mockSession.sendAndWait.mockResolvedValue({
      type: 'assistant.message',
      id: 'learning-output',
      parentId: null,
      timestamp: new Date(0).toISOString(),
      data: { content: 'done', messageId: 'message' },
    });

    // Run QA workflow (should pick up global learnings)
    await runCommand(tmpDir, 'clean', {}, 'qa');

    const promptText = mockSession.sendAndWait.mock.calls[0][0].prompt;
    expect(promptText).toContain('Global: remember this');
  });

  it("'scope: workflow' writes learnings to the workflow learnings file (not global)", async () => {
    writeNamedWorkflow(
      tmpDir,
      'main',
      `initial: produce
states:
  produce:
    type: command
    command: |
      echo "Output
      LESSON: Workflow-only lesson"
    output:
      store: true
    teach:
      agent3:
        - output: produce
          scope: workflow
    on:
      PASSED: done
  done:
    type: engine
`,
    );

    writeAgentRegistry(tmpDir, { agent3: { path: './agents/agent3.md' } });
    writeScriptRegistry(tmpDir, {});
    writeAgentFile(tmpDir, 'agents/agent3.md', 'Agent 3');

    (spawn as jest.Mock).mockImplementation((cmd: string, args?: any[], opts?: any) => {
      if (cmd === 'sh' && Array.isArray(args) && typeof args[1] === 'string') {
        const invoked = args[1] as string;
        if (invoked.includes('echo')) {
          return fakeChild('Output\nLESSON: Workflow-only lesson\n', '', 0);
        }
      }
      return fakeChild('', '', 0);
    });

    await runCommand(tmpDir, 'clean', {});

    const globalLearnings = path.join(tmpDir, '.raili', 'learnings', 'agent3.md');
    const workflowLearnings = path.join(tmpDir, '.raili', 'main', 'learnings', 'agent3.md');

    expect(fs.existsSync(workflowLearnings)).toBe(true);
    expect(fs.existsSync(globalLearnings)).toBe(false);
    const content = fs.readFileSync(workflowLearnings, 'utf8');
    expect(content).toContain('Workflow-only lesson');
  });
});
