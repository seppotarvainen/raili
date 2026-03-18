import * as fs from 'fs';
import * as path from 'path';
import { readLearnings, appendUniqueLearning } from '../../src/learningStore';

describe('learningStore appendUniqueLearning', () => {
  const cwd = path.join(__dirname, 'tmp_project_ls');
  const railiDir = path.join(cwd, '.raili');
  const learningsDir = path.join(railiDir, 'learnings');

  beforeEach(() => {
    if (fs.existsSync(cwd)) fs.rmSync(cwd, { recursive: true, force: true });
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
});
