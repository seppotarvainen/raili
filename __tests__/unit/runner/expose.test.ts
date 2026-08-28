import {runCommandState} from '../../../src/runner/commandStateRunner';
import {runScriptState} from '../../../src/runner/scriptStateRunner';
import {validateStateConfig} from '../../../src/workflow/schemaValidator';
import {Runner} from '../../../src/runner/runner';

jest.mock('../../../src/handlers/commandHandler');
jest.mock('../../../src/handlers/scriptHandler');

// Prevent the Engine (and any other caller of saveContext / addStateToHistory)
// from writing real files to the project root or any disk location.
jest.mock('../../../src/context/context', () => ({
  getCurrentState: jest.fn().mockReturnValue(null),
  addStateToHistory: jest.fn((ctx: any) => ctx),
  saveContext: jest.fn(),
}));

const { executeCommand } = require('../../../src/handlers/commandHandler');
const { executeScript } = require('../../../src/handlers/scriptHandler');

describe('expose variables feature', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    // jest.resetAllMocks() clears implementations set in jest.mock() factories too.
    // Re-initialise the context mocks so addStateToHistory returns a valid context
    // (otherwise this.context becomes undefined inside Engine.run and crashes).
    const ctxMock = require('../../../src/context/context');
    (ctxMock.getCurrentState as jest.Mock).mockReturnValue(null);
    (ctxMock.addStateToHistory as jest.Mock).mockImplementation((ctx: any) => ctx);
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

    const res = await runCommandState(state, '/tmp', {});
    expect(res.exports).toBeDefined();
    expect(res.exports!['id']).toBe('123');
    expect(res.outcome).toBe('PASSED');
  });

  test('runCommandState exposes a raw value ending in a newline', async () => {
    executeCommand.mockResolvedValue({ success: true, stdout: '4f3c2a1b9d0e\n', stderr: '' });

    const state = {
      id: 'c1',
      config: {
        type: 'command',
        command: 'git rev-parse HEAD',
        expose: ['commit_id'],
        on: { PASSED: 'next', FAILED: 'error' },
      },
    } as any;

    const res = await runCommandState(state, '/tmp', {});
    expect(res.exports).toEqual({ commit_id: '4f3c2a1b9d0e' });
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

    const res = await runScriptState(state, {}, '/tmp', {} as any);
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
    const mockRunScript = jest.spyOn(require('../../../src/runner/scriptStateRunner'), 'runScriptState')
      .mockResolvedValue({ outcome: 'PASSED', exports: {} });

    const stateMachine = {
      initial: 's1',
      states: {
        s1: { id: 's1', config: { type: 'script', script: 'x', expose: ['id'], on: { PASSED: 'end' } }, transitions: ['end'] },
        end: { id: 'end', config: { type: 'engine' }, transitions: [] }
      }
    } as any;

    const engine = new Runner({ stateMachine, agentRegistry: {}, scriptRegistry: {}, context: { stateHistory: [] }, cwd: '/tmp' });

    await expect(engine.run()).rejects.toThrow(/exposed variable 'id'/);

    mockRunScript.mockRestore();
  });

  test('engine does not throw when optional expose (?) is not produced', async () => {
    const mockRunScript = jest.spyOn(require('../../../src/runner/scriptStateRunner'), 'runScriptState')
      .mockResolvedValue({ outcome: 'PASSED', exports: {} });

    const stateMachine = {
      initial: 's1',
      states: {
        s1: { id: 's1', config: { type: 'script', script: 'x', expose: ['next_part?'], on: { PASSED: 'end' } }, transitions: ['end'] },
        end: { id: 'end', config: { type: 'engine' }, transitions: [] }
      }
    } as any;

    const engine = new Runner({ stateMachine, agentRegistry: {}, scriptRegistry: {}, context: { stateHistory: [] }, cwd: '/tmp' });

    await expect(engine.run()).resolves.not.toThrow();

    mockRunScript.mockRestore();
  });

  test('engine stores optional expose under base name when produced', async () => {
    const mockRunScript = jest.spyOn(require('../../../src/runner/scriptStateRunner'), 'runScriptState')
      .mockResolvedValue({ outcome: 'PASSED', exports: { next_part: 'pt2' } });

    const stateMachine = {
      initial: 's1',
      states: {
        s1: { id: 's1', config: { type: 'script', script: 'x', expose: ['next_part?'], on: { PASSED: 'end' } }, transitions: ['end'] },
        end: { id: 'end', config: { type: 'engine' }, transitions: [] }
      }
    } as any;

    const context: any = { stateHistory: [], vars: {} };
    const engine = new Runner({ stateMachine, agentRegistry: {}, scriptRegistry: {}, context, cwd: '/tmp' });

    await engine.run();

    expect(context.vars['next_part']).toBe('pt2');

    mockRunScript.mockRestore();
  });

  test('parseExports strips ? suffix before matching', () => {
    const { parseExports } = require('../../../src/variables/variableExports');
    const result = parseExports('next_part=pt3\n', ['next_part?']);
    expect(result['next_part']).toBe('pt3');
    expect(result['next_part?']).toBeUndefined();
  });
});
