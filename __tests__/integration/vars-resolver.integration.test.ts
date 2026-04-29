import fs from 'fs';
import path from 'path';
import { runCommand } from '../../src/run';
import { loadContext } from '../../src/context/context';
import {
  cleanupRailiEnvVars,
  cleanupTmpWorkspace,
  createTmpWorkspace,
  fakeChild,
  writeWorkflow,
  writeAgentRegistry,
  writeScriptRegistry,
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

describe('vars-resolver integration', () => {
  it('calls resolver and merges variables (resolver result used when CLI not provided)', async () => {
    writeWorkflow(
      tmpDir,
      `initial: done
states:
  done:
    type: engine
`,
    );
    writeAgentRegistry(tmpDir, {});
    writeScriptRegistry(tmpDir, {});

    // create a vars-resolver that returns ticket_id
    const resolverPath = path.join(tmpDir, '.raili', 'main', 'vars-resolver.js');
    fs.writeFileSync(
      resolverPath,
      `module.exports = async function resolveVars(input) { return { ticket_id: 'PROJ-123', branch: 'fromResolver' }; }\n`,
      'utf8',
    );

    await runCommand(tmpDir, 'clean', {}, undefined, false, undefined, undefined, ['card=1']);

    const ctx = loadContext(tmpDir);
    expect(ctx.vars).toBeDefined();
    expect(ctx.vars!.ticket_id).toBe('PROJ-123');
    expect(ctx.vars!.branch).toBe('fromResolver');
  });

  it('CLI vars override resolver results', async () => {
    writeWorkflow(
      tmpDir,
      `initial: done
states:
  done:
    type: engine
`,
    );
    writeAgentRegistry(tmpDir, {});
    writeScriptRegistry(tmpDir, {});

    const resolverPath = path.join(tmpDir, '.raili', 'main', 'vars-resolver.js');
    fs.writeFileSync(
      resolverPath,
      `module.exports = async function resolveVars(input) { return { ticket_id: 'PROJ-123' }; }\n`,
      'utf8',
    );

    await runCommand(
      tmpDir,
      'clean',
      { ticket_id: 'CLI-1' }, // CLI should win
      undefined,
      false,
      undefined,
      undefined,
      ['card=2'],
    );

    const ctx = loadContext(tmpDir);
    expect(ctx.vars!.ticket_id).toBe('CLI-1');
  });

  it('throws when --resolve-vars provided but vars-resolver.js missing', async () => {
    writeWorkflow(
      tmpDir,
      `initial: done
states:
  done:
    type: engine
`,
    );
    writeAgentRegistry(tmpDir, {});
    writeScriptRegistry(tmpDir, {});

    await expect(
      runCommand(tmpDir, 'clean', {}, undefined, false, undefined, undefined, ['only-flag']),
    ).rejects.toThrow(/vars-resolver\.js/);
  });

  it('treats null resolver result as empty and continues', async () => {
    writeWorkflow(
      tmpDir,
      `initial: done
states:
  done:
    type: engine
`,
    );
    writeAgentRegistry(tmpDir, {});
    writeScriptRegistry(tmpDir, {});

    // create a resolver that returns null
    const resolverPath = path.join(tmpDir, '.raili', 'main', 'vars-resolver.js');
    fs.writeFileSync(
      resolverPath,
      `module.exports = async function resolveVars(input) { return null; }\n`,
      'utf8',
    );

    // Also create vars.yaml with a value to ensure it is preserved
    fs.writeFileSync(
      path.join(tmpDir, '.raili', 'main', 'vars.yaml'),
      'branch: fromVars\n',
      'utf8',
    );

    await runCommand(tmpDir, 'clean', {}, undefined, false, undefined, undefined, ['arg']);

    const ctx = loadContext(tmpDir);
    expect(ctx.vars!.branch).toBe('fromVars');
  });
});
