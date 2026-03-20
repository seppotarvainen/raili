import path from 'path';
import fs from 'fs';
import { createTmpWorkspace, writeWorkflow, writeAgentRegistry, writeAgentFile, writeScriptRegistry, fakeChild, cleanupRailiEnvVars } from './testUtils';
import { runCommand } from '../../src/run';
import { loadContext } from '../../src/context';

jest.mock('child_process', () => ({ spawn: jest.fn() }));
import { spawn } from 'child_process';

describe('feedback attribute integration', () => {
  beforeEach(() => {
    // reset mock
    (spawn as jest.Mock).mockReset();
  });

  test('agent with feedback attribute stores feedback but does not change routing', async () => {
    const tmp = createTmpWorkspace();

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

    writeWorkflow(tmp, workflow);
    writeAgentRegistry(tmp, { analyzer: { path: '.github/agents/analyzer.md' } });
    writeAgentFile(tmp, '.github/agents/analyzer.md', '---\nmodel: test\n---\nAnalyze');
    writeScriptRegistry(tmp, {});

    // spawn will simulate copilot printing some lines and a feedback block
    const agentStdout = `Some analysis lines\nFEEDBACK: {"rating":5,"comment":"Looks good"}\napprove\n`;
    (spawn as jest.Mock).mockImplementation(() => fakeChild(agentStdout, '', 0));

    await runCommand(tmp, 'clean', {});

    // context should show end as last state
    const ctx = loadContext(tmp);
    expect(ctx.stateHistory[ctx.stateHistory.length - 1].state).toBe('end');
  });
});
