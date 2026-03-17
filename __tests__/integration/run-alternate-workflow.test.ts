import {runCommand} from '../../src/run';
import {loadContext} from '../../src/context';
import {
    cleanupRailiEnvVars,
    cleanupTmpWorkspace,
    createTmpWorkspace,
    fakeChild,
    writeAgentRegistry,
    writeScriptRegistry,
    writeWorkflow,
    writeWorkflowFile,
    //@ts-ignore
} from './testUtils';

// Mock child_process globally — alternate workflow uses engine states so spawn is still used for notify
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

describe('run (integration - alternate workflow)', () => {
  it('runs with alternate workflow and respects workflowPath', async () => {
    // Default workflow.yaml should point to 'main'
    writeWorkflow(tmpDir, `
initial: main
states:
  main:
    type: engine
`);

    // Alternate workflow in .raili/ with a different initial state
    writeWorkflowFile(tmpDir, 'workflow-dev.yaml', `
initial: devstart
states:
  devstart:
    type: engine
`);

    writeAgentRegistry(tmpDir, {});
    writeScriptRegistry(tmpDir, {});

    await runCommand(tmpDir, 'clean', {}, 'workflow-dev.yaml');

    const ctx = loadContext(tmpDir);
    const states = ctx.stateHistory.map((e: any) => e.state);
    expect(states).toEqual(['devstart']);
  });
});
