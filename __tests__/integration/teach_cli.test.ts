import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import { EventEmitter } from 'events';
import {
  createTmpWorkspace,
  cleanupTmpWorkspace,
  writeAgentRegistry,
  writeAgentFile,
} from './testUtils';

jest.mock('readline');

describe('CLI teach flow', () => {
  const ORIGINAL_CWD = process.cwd();
  let tmp: string;
  let exitMock: jest.SpyInstance;

  beforeEach(() => {
    tmp = createTmpWorkspace();
    // mock process.exit to throw so we can continue
    exitMock = jest.spyOn(process, 'exit').mockImplementation((code?: string | number | null) => {
      throw new Error('EXIT:' + (code ?? 0));
    });
  });

  afterEach(() => {
    cleanupTmpWorkspace(tmp);
    jest.restoreAllMocks();
    try {
      process.chdir(ORIGINAL_CWD);
    } catch {}
  });

  test('raili teach <agentId> (positional) appends learning file', async () => {
    // Prepare argv to simulate: node raili teach agent1
    process.argv = ['node', 'raili', 'teach', 'agent1'];
    // Change cwd to tmp workspace
    process.chdir(tmp);

    // Ensure agent registry and agent file exist so teachCommand can succeed
    writeAgentRegistry(tmp, { agent1: { path: '.raili/main/learnings/agent1.md' } });
    writeAgentFile(tmp, '.raili/main/learnings/agent1.md', '# agent1\n');

    // Mock readline to emit a line and then /q
    (readline.createInterface as unknown as jest.Mock).mockImplementation(() => {
      const rl = new EventEmitter();
      (rl as any).close = () => rl.emit('close');
      setImmediate(() => {
        rl.emit('line', 'Remember to document edge cases.');
        rl.emit('line', '/q');
      });
      return rl as unknown as readline.Interface;
    });

    // Import CLI after setting argv so module-level argv is captured correctly
    let cliModule: any;
    try {
      jest.isolateModules(() => {
        cliModule = require('../../src/cli');
      });
      await cliModule.main();
    } catch (err: any) {
      // expect process.exit to have been called with 0
      if (!String(err.message).startsWith('EXIT:0')) throw err;
    }

    const file = path.join(tmp, '.raili', 'learnings', 'agent1.md');
    expect(fs.existsSync(file)).toBe(true);
    const content = fs.readFileSync(file, 'utf8');
    expect(content).toContain('[manual]');
    expect(content).toContain('Remember to document edge cases.');
  });

  test('raili teach nonexistent agent fails fast', async () => {
    process.argv = ['node', 'raili', 'teach', 'ghost'];
    process.chdir(tmp);

    // No agent registry or registry missing the agent -> should exit non-zero
    let cliModule: any;
    try {
      jest.isolateModules(() => {
        cliModule = require('../../src/cli');
      });
      await cliModule.main();
      throw new Error('Expected process.exit with non-zero');
    } catch (err: any) {
      // Exit should have been called with non-zero code
      expect(String(err.message)).toMatch(/^EXIT:/);
      const code = Number(String(err.message).split(':')[1]);
      expect(code).not.toBe(0);
    }
  });
});
