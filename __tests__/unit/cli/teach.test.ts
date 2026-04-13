import * as readline from 'readline';

jest.mock('readline');

jest.mock('../../../src/context/learningStore', () => ({
  appendManualLearning: jest.fn().mockReturnValue(true),
  learningsFilePath: jest.fn().mockReturnValue('/fake/path'),
}));

// Ensure module identity matches code imports when loaded via absolute path
jest.mock('/Users/seppo.tarvainen/Competence/raili/src/context/learningStore', () => ({
  appendManualLearning: jest.fn().mockReturnValue(true),
  learningsFilePath: jest.fn().mockReturnValue('/fake/path'),
}));

describe('cli teach --scope flag', () => {
  let exitSpy: jest.SpyInstance;
  beforeEach(() => {
    jest.clearAllMocks();
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
});
