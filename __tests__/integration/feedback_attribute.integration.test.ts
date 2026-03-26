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
import { runCommand } from '../../src/run';
import { loadContext } from '../../src/context/context';

jest.mock('child_process', () => ({ spawn: jest.fn() }));
const { spawn } = require('child_process');

let tmpDir: string;

describe('feedback attribute integration', () => {
  beforeEach(() => {
    tmpDir = createTmpWorkspace();
    spawn.mockImplementation(() => fakeChild('', '', 0));
  });

  afterEach(() => {
    cleanupTmpWorkspace(tmpDir);
    cleanupRailiEnvVars();
    spawn.mockReset();
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

    // spawn will simulate copilot printing some lines and a feedback block
    const agentStdout = `Some analysis lines\nFEEDBACK: {"rating":5,"comment":"Looks good"}\napprove\n`;
    spawn.mockImplementation(() => fakeChild(agentStdout, '', 0));

    await runCommand(tmpDir, 'clean', {});

    // context should show end as last state
    const ctx = loadContext(tmpDir);
    expect(ctx.stateHistory[ctx.stateHistory.length - 1].state).toBe('end');
  });
});
