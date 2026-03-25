import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { appendUniqueLearning, readLearnings } from '../../../src/context/learningStore';

describe('learningStore flattened persistence', () => {
  let cwd: string;
  let learningsDir: string;

  beforeEach(() => {
    cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'raili-learning-test-'));
    learningsDir = path.join(cwd, '.raili', 'main', 'learnings');
    fs.mkdirSync(learningsDir, { recursive: true });
  });

  afterEach(() => {
    if (fs.existsSync(cwd)) fs.rmSync(cwd, { recursive: true, force: true });
  });

  test('appendUniqueLearning stores learnings under parent workflow learnings dir', () => {
    const added = appendUniqueLearning(cwd, 'agentX', 'test_source', 'lesson: important lesson\ndetails', 'main');
    expect(added).toBe(true);

    const p = path.join(cwd, '.raili', 'main', 'learnings', 'agentX.md');
    expect(fs.existsSync(p)).toBe(true);

    const stored = readLearnings(cwd, 'agentX', 'main');
    expect(stored).toContain('important lesson');
    expect(stored).toContain('details');
  });
});
