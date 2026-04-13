import * as path from 'path';
import { setupFakeFs } from '../infrastructure/fsFake.util';
import { getFileSystem } from '../../../src/infrastructure/fileSystemProvider';
import { appendUniqueLearning, readLearnings } from '../../../src/context/learningStore';

describe('learningStore flattened persistence', () => {
  let cwd: string;
  let learningsDir: string;
  let restoreFs: () => void;

  beforeEach(() => {
    restoreFs = setupFakeFs();
    cwd = '/tmp/test-workspace';
    learningsDir = path.join(cwd, '.raili', 'main', 'learnings');
    getFileSystem().mkdirSync(learningsDir, { recursive: true } as any);
  });

  afterEach(() => {
    restoreFs();
  });

  test('appendUniqueLearning stores learnings under parent workflow learnings dir', () => {
    const added = appendUniqueLearning(cwd, 'agentX', 'test_source', 'lesson: important lesson\ndetails', 'main', 'workflow');
    expect(added).toBe(true);

    const p = path.join(cwd, '.raili', 'main', 'learnings', 'agentX.md');
    expect(getFileSystem().existsSync(p)).toBe(true);

    const stored = readLearnings(cwd, 'agentX', 'main');
    expect(stored).toContain('important lesson');
    expect(stored).toContain('details');
  });
});
