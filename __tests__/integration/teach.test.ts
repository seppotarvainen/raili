import * as readline from 'readline';
import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as path from 'path';
import { createTmpWorkspace, cleanupTmpWorkspace } from './testUtils';
import { teachCommand } from '../../src/cli/teach';

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

    await teachCommand(tmp, 'agent1', 'main');

    const file = path.join(tmp, '.raili', 'main', 'learnings', 'agent1.md');
    expect(fs.existsSync(file)).toBe(true);
    const content = fs.readFileSync(file, 'utf8');
    expect(content).toContain('[manual]');
    expect(content).toContain('Remember to check edge cases in input validation.');
  });
});
