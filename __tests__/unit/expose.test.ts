import { runCommandState } from '../../src/engine/CommandStateRunner';
import { runScriptState } from '../../src/engine/ScriptStateRunner';
import { validateStateConfig } from '../../src/schemaValidator';
import { Engine } from '../../src/engine/Engine';

jest.mock('../../src/handlers/commandHandler');
jest.mock('../../src/handlers/scriptHandler');

const { executeCommand } = require('../../src/handlers/commandHandler');
const { executeScript } = require('../../src/handlers/scriptHandler');

describe('expose variables feature', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  test('runCommandState extracts exposed variable from stdout', async () => {
    executeCommand.mockResolvedValue({ success: true, stdout: 'id=123\nother=val\n', stderr: '' });

    const state = {
      id: 'c1',
      config: {
        type: 'command',
        command: 'echo',
        expose: ['id']
      }
    } as any;

    const res = await runCommandState(state, process.cwd(), {});
    expect(res.exports).toBeDefined();
    expect(res.exports!['id']).toBe('123');
    expect(res.outcome).toBe('PASSED');
  });

  test('runScriptState extracts exposed variables from stdout', async () => {
    executeScript.mockResolvedValue({ success: true, stdout: 'token=abc\n', stderr: '' });

    const state = {
      id: 's1',
      config: {
        type: 'script',
        script: 'gen',
        expose: ['token']
      }
    } as any;

    const res = await runScriptState(state, {}, process.cwd(), {} as any);
    expect(res.exports).toBeDefined();
    expect(res.exports!['token']).toBe('abc');
  });

  test('schema validation rejects expose on agent type', () => {
    const cfg = {
      type: 'agent',
      agent: 'analyzer',
      expose: ['id']
    } as any;

    expect(() => validateStateConfig(cfg, 'bad')).toThrow(/expose/);
  });

  test('engine throws when declared expose not produced', async () => {
    // Mock runScriptState to return no exports
    const mockRunScript = jest.spyOn(require('../../src/engine/ScriptStateRunner'), 'runScriptState')
      .mockResolvedValue({ outcome: 'PASSED', exports: {} });

    const stateMachine = {
      initial: 's1',
      states: {
        s1: { id: 's1', config: { type: 'script', script: 'x', expose: ['id'], on: { PASSED: 'end' } }, transitions: ['end'] },
        end: { id: 'end', config: { type: 'engine' }, transitions: [] }
      }
    } as any;

    const engine = new Engine({ stateMachine, agentRegistry: {}, scriptRegistry: {}, context: { stateHistory: [] }, cwd: process.cwd() });

    await expect(engine.run()).rejects.toThrow(/exposed variable 'id'/);

    mockRunScript.mockRestore();
  });
});
