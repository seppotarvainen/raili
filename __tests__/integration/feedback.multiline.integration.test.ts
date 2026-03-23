import {runCommand} from '../../src/run';
import {loadContext} from '../../src/context/context';
import {
    cleanupRailiEnvVars,
    cleanupTmpWorkspace,
    createTmpWorkspace,
    fakeChild,
    writeAgentRegistry,
    writeScriptRegistry,
    writeWorkflow,
} from './testUtils';

jest.mock('child_process', () => ({ spawn: jest.fn() }));
const { spawn } = require('child_process');

let tmpDir: string;

beforeEach(() => {
  tmpDir = createTmpWorkspace();
  // default: noop child
  spawn.mockImplementation(() => fakeChild('', '', 0));
});

afterEach(() => {
  cleanupTmpWorkspace(tmpDir);
  cleanupRailiEnvVars();
  spawn.mockReset();
});

describe('integration: feedback multiline end-to-end', () => {
  it('captures multiline feedback via RAILI_FEEDBACK_ env and exposes to downstream command preserving newlines', async () => {
    writeWorkflow(tmpDir, `initial: ask
states:
  ask:
    type: engine
    feedback:
      expose_var: note
      multiline: true
    transitions:
      next: use
  use:
    type: command
    command: echo "$RAILI_VAR_NOTE"
    on:
      PASSED: done
  done:
    type: engine
`);

    writeAgentRegistry(tmpDir, {});
    writeScriptRegistry(tmpDir, {});

    // Simulate multiline feedback provided via env var to bypass stdin
    process.env.RAILI_FEEDBACK_NOTE = 'line1\nline2';

    // When sh -c "echo ..." is invoked, return stdout containing the env value
    spawn.mockImplementation((cmd: string, args?: any[], opts?: any) => {
      if (cmd === 'sh' && Array.isArray(args) && typeof args[1] === 'string') {
        const invoked = args[1] as string;
        if (invoked.includes('echo')) {
          const val = opts && opts.env ? opts.env['RAILI_VAR_NOTE'] : undefined;
          return fakeChild((val ? String(val) : '') + '\n', '', 0);
        }
      }
      return fakeChild('', '', 0);
    });

    await runCommand(tmpDir, 'clean', {});

    const ctx = loadContext(tmpDir);
    // Feedback should be persisted into vars with newlines preserved
    expect(ctx.vars).toBeDefined();
    expect(ctx.vars!['note']).toBe('line1\nline2');

    // Ensure downstream command was invoked and its env contained RAILI_VAR_NOTE
    const shCalls = spawn.mock.calls.filter((c: any[]) => c[0] === 'sh');
    expect(shCalls.length).toBeGreaterThan(0);
    const useCall = shCalls.find((c: any[]) => Array.isArray(c[1]) && typeof c[1][1] === 'string' && c[1][1].includes('echo'));
    expect(useCall).toBeDefined();
    const opts = useCall[2];
    expect(opts).toBeDefined();
    expect(opts.env['RAILI_VAR_NOTE']).toBe('line1\nline2');

    // Ensure workflow reached done
    expect(ctx.stateHistory[ctx.stateHistory.length - 1].state).toBe('done');
  });
});
