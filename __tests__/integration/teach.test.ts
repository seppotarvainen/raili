import * as readline from 'readline';
import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as path from 'path';
import {
  createTmpWorkspace,
  cleanupTmpWorkspace,
  cleanupRailiEnvVars,
  fakeChild,
  writeAgentFile,
  writeAgentRegistry,
  writeScriptRegistry,
  writeWorkflow,
} from './testUtils';
import { teachCommand } from '../../src/cli/teach';
import { runCommand } from '../../src/run';

jest.mock('readline');

describe('teachCommand integration', () => {
  let tmp: string;

  beforeEach(() => {
    tmp = createTmpWorkspace();
  });

  afterEach(() => {
    cleanupTmpWorkspace(tmp);
    jest.restoreAllMocks();
  });

  test('writes manual learning to workflow learnings file', async () => {
    // Mock readline.createInterface to emit two lines then close
    (readline.createInterface as unknown as jest.Mock).mockImplementation(() => {
      const rl = new EventEmitter();
      (rl as any).close = () => rl.emit('close');
      setImmediate(() => {
        rl.emit('line', 'Remember to check edge cases in input validation.');
        rl.emit('line', '/q');
      });
      return rl as unknown as readline.Interface;
    });

    // Ensure registries and agent file exist (fail-fast requires agent-registry.json)
    writeAgentRegistry(tmp, { agent1: { path: './agents/agent1.md' } });
    writeScriptRegistry(tmp, {});
    writeAgentFile(tmp, 'agents/agent1.md', 'Agent 1 instructions');

    await teachCommand(tmp, 'agent1', 'main');

    const file = path.join(tmp, '.raili', 'learnings', 'agent1.md');
    expect(fs.existsSync(file)).toBe(true);
    const content = fs.readFileSync(file, 'utf8');
    expect(content).toContain('[manual]');
    expect(content).toContain('Remember to check edge cases in input validation.');
  });

  describe('teach validation', () => {
    it('throws during workflow validation when teach references unknown agent', async () => {
      // Create a workflow that teaches agent2 which is not in the registry
      const tmp = createTmpWorkspace();
      try {
        writeWorkflow(
          tmp,
          `
initial: start
inputs: [SOME_VAR]
states:
  start:
    type: agent
    agent: agent1
    output:
      store: true
    transitions:
      next: done
    teach:
      agent2:
        - var: "${'${SOME_VAR}'}"
  done:
    type: engine
`,
        );

        writeAgentRegistry(tmp, { agent1: { path: './agents/agent1.md' } });
        writeScriptRegistry(tmp, {});
        writeAgentFile(tmp, 'agents/agent1.md', 'Agent 1 instructions');

        let caught: any = null;
        try {
          await runCommand(tmp, 'clean', {});
        } catch (e) {
          caught = e;
        }

        expect(caught).not.toBeNull();
        expect(String(caught.message || caught)).toContain('teach');
        expect(String(caught.message || caught)).toContain('agent2');
      } finally {
        cleanupTmpWorkspace(tmp);
      }
    });
  });
});
