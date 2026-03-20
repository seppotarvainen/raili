import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { readLearnings, appendUniqueLearning } from '../../src/learningStore';

describe('learningStore appendUniqueLearning', () => {
  let cwd: string;
  let learningsDir: string;

  beforeEach(() => {
    cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'raili-ls-test-'));
    learningsDir = path.join(cwd, '.raili', 'main', 'learnings');
    fs.mkdirSync(learningsDir, { recursive: true });
  });

  afterEach(() => {
    if (fs.existsSync(cwd)) fs.rmSync(cwd, { recursive: true, force: true });
  });

  test('appends new learning and deduplicates', () => {
    const agentId = 'my-agent';
    const appended = appendUniqueLearning(cwd, agentId, 'output:test', 'Something happened');
    expect(appended).toBe(true);
    const again = appendUniqueLearning(cwd, agentId, 'output:test', 'Something happened');
    expect(again).toBe(false);
    const content = readLearnings(cwd, agentId);
    expect(content).toContain('Something happened');
  });

  test('does not add empty lesson', () => {
    const agentId = 'my-agent';
    const appended = appendUniqueLearning(cwd, agentId, 'output:test', ' ');
    expect(appended).toBe(false);
    const content = readLearnings(cwd, agentId);
    expect(content).not.toContain(' ');
  });

});
