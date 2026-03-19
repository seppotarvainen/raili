import fs from 'fs';
import path from 'path';
import {runCommand} from '../../src/run';
import {
    cleanupRailiEnvVars,
    cleanupTmpWorkspace,
    createTmpWorkspace,
    fakeChild,
    writeAgentRegistry,
    writeNamedWorkflow,
    writeScriptRegistry,
    writeWorkflow,
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
  it('runs with named workflow and persists context in its own directory', async () => {
    // Default main workflow
    writeWorkflow(tmpDir, `
initial: main
states:
  main:
    type: engine
`);

    // Named workflow 'dev'
    writeNamedWorkflow(tmpDir, 'dev', `
initial: devstart
states:
  devstart:
    type: engine
`);

    writeAgentRegistry(tmpDir, {});
    writeScriptRegistry(tmpDir, {});

    await runCommand(tmpDir, 'clean', {}, 'dev');

    // Context should be in .raili/dev/context.json
    const ctxPath = path.join(tmpDir, '.raili', 'dev', 'context.json');
    expect(fs.existsSync(ctxPath)).toBe(true);
    const ctx = JSON.parse(fs.readFileSync(ctxPath, 'utf8'));
    const states = ctx.stateHistory.map((e: any) => e.state);
    expect(states).toEqual(['devstart']);
  });
});
