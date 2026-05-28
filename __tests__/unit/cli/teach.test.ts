import * as readline from 'readline';

jest.mock('readline');

jest.mock('../../../src/context/learningStore', () => ({
  appendManualLearning: jest.fn().mockReturnValue(true),
  learningsFilePath: jest.fn().mockReturnValue('/fake/path'),
}));

jest.mock('../../../src/context/pathUtils', () => ({
  learningsFilePath: jest.fn().mockReturnValue('/fake/path'),
}));

// Mock agent registry to control registry contents for tests
jest.mock('../../../src/registry/agentRegistry', () => ({
  loadAgentRegistry: jest.fn(),
}));

describe('cli teach --scope flag', () => {
  let exitSpy: jest.SpyInstance;
  beforeEach(() => {
    jest.clearAllMocks();
    // Default mocked agent registry contains 'agent1' for tests that assume it exists
    const agentRegistry = require('../../../src/registry/agentRegistry');
    (agentRegistry.loadAgentRegistry as jest.Mock).mockReturnValue({ agent1: { path: '/fake' } });

    exitSpy = jest.spyOn(process, 'exit').mockImplementation((code?: string | number | null | undefined) => {
      throw new Error('EXIT:' + String(code));
    });
  });

  afterEach(() => {
    // Restore process.exit spy to avoid leaking into other tests
    if (exitSpy && exitSpy.mockRestore) {
      exitSpy.mockRestore();
    }
  });

  test('passes scope flag to appendManualLearning', async () => {
    // Simulate argv: raili teach agent1 --scope workflow
    process.argv = ['node', 'raili', 'teach', 'agent1', '--scope', 'workflow'];

    // Mock readline to emit a line and then /q
    (readline.createInterface as unknown as jest.Mock).mockImplementation(() => {
      const events: any = require('events');
      const rl = new events.EventEmitter();
      (rl as any).close = () => rl.emit('close');
      setImmediate(() => {
        rl.emit('line', 'Lesson: make it fast');
        rl.emit('line', '/q');
      });
      return rl as unknown as readline.Interface;
    });

    // Call teachCommand directly to avoid CLI-level process.exit interactions and ensure the
    // learningStore import is the mocked module.
    const { teachCommand } = require('../../../src/cli/teach');
    await teachCommand(process.cwd(), 'agent1', undefined, 'workflow');

    const { appendManualLearning } = require('../../../src/context/learningStore');
    expect(appendManualLearning).toHaveBeenCalled();
    // last arg should be the scope 'workflow'
    const call = (appendManualLearning as jest.Mock).mock.calls[0];
    expect(call[4]).toBe('workflow');
  });

  test('fails fast when agent missing', async () => {
    const agentRegistry = require('../../../src/registry/agentRegistry');
    (agentRegistry.loadAgentRegistry as jest.Mock).mockReturnValue({ agent1: { path: '/fake' } });
    const { teachCommand } = require('../../../src/cli/teach');

    await expect(teachCommand(process.cwd(), 'agent2')).rejects.toThrow("Agent 'agent2' is not defined in agent-registry.json");
  });
});
