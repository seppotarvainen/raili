import { runCommand } from '../../src/run';
import { loadContext } from '../../src/context/context';
import {
  cleanupRailiEnvVars,
  cleanupTmpWorkspace,
  createTmpWorkspace,
  fakeChild,
  writeAgentRegistry,
  writeScriptRegistry,
  writeWorkflow,
  writeNamedWorkflow,
} from './testUtils';

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

describe('workflow variable exported to shell commands', () => {
  it('sets RAILI_VAR_WORKFLOW for default workflow', async () => {
    writeWorkflow(
      tmpDir,
      `
initial: show
states:
  show:
    type: command
    command: "echo $RAILI_VAR_WORKFLOW"
    on:
      PASSED: done
  done:
    type: engine
`,
    );

    writeScriptRegistry(tmpDir, {});
    writeAgentRegistry(tmpDir, {});

    let capturedEnv: string | undefined;

    spawn.mockImplementation((cmd: string, args: any[], opts: any) => {
      if (cmd === 'sh') {
        capturedEnv = opts.env && opts.env.RAILI_VAR_WORKFLOW;
        return fakeChild('ok', '', 0);
      }
      return fakeChild('', '', 0);
    });

    await runCommand(tmpDir, 'clean', {});

    expect(capturedEnv).toBe('main');
    const ctx = loadContext(tmpDir);
    expect(ctx.vars!.workflow).toBe('main');
  });

  it('sets RAILI_VAR_WORKFLOW for named workflow', async () => {
    writeNamedWorkflow(
      tmpDir,
      'dev',
      `
initial: show
states:
  show:
    type: command
    command: "echo $RAILI_VAR_WORKFLOW"
    on:
      PASSED: done
  done:
    type: engine
`,
    );

    writeScriptRegistry(tmpDir, {});
    writeAgentRegistry(tmpDir, {});

    let capturedEnv: string | undefined;

    spawn.mockImplementation((cmd: string, args: any[], opts: any) => {
      if (cmd === 'sh') {
        capturedEnv = opts.env && opts.env.RAILI_VAR_WORKFLOW;
        return fakeChild('ok', '', 0);
      }
      return fakeChild('', '', 0);
    });

    await runCommand(tmpDir, 'clean', {}, 'dev');

    expect(capturedEnv).toBe('dev');
    const ctx = loadContext(tmpDir, 'dev');
    expect(ctx.vars!.workflow).toBe('dev');
  });
});
