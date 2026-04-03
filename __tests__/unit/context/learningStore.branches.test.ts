import * as path from 'path';
import { setupFakeFs } from '../infrastructure/fsFake.util';
import { getFileSystem } from '../../../src/infrastructure/fileSystemProvider';
import {
  appendUniqueLearning,
  appendManualLearning,
  extractLessons,
  readLearningsForPrompt,
} from '../../../src/context/learningStore';

describe('learningStore branch coverage', () => {
  let cwd: string;
  let restoreFs: () => void;

  beforeEach(() => {
    restoreFs = setupFakeFs();
    cwd = '/tmp/test-workspace';
    const learningsDir = path.join(cwd, '.raili', 'main', 'learnings');
    getFileSystem().mkdirSync(learningsDir, { recursive: true } as any);
  });

  afterEach(() => {
    restoreFs();
  });

  // extractLessons: empty/falsy content → returns []
  test('extractLessons with empty string returns empty array', () => {
    expect(extractLessons('')).toEqual([]);
  });

  test('extractLessons with whitespace-only string returns empty array', () => {
    expect(extractLessons('   ')).toEqual([]);
  });

  // appendUniqueLearning: empty content → returns false
  test('appendUniqueLearning with empty content returns false', () => {
    expect(appendUniqueLearning(cwd, 'agent', 'src', '')).toBe(false);
  });

  test('appendUniqueLearning with whitespace-only content returns false', () => {
    expect(appendUniqueLearning(cwd, 'agent', 'src', '   ')).toBe(false);
  });

  // appendUniqueLearning: directory already exists (no mkdir needed)
  test('appendUniqueLearning works when learnings dir already exists', () => {
    const result = appendUniqueLearning(cwd, 'agent', 'output:test', 'LESSON: already there');
    expect(result).toBe(true);
  });

  // appendManualLearning: empty content → returns false
  test('appendManualLearning with empty content returns false', () => {
    expect(appendManualLearning(cwd, 'agent', '')).toBe(false);
  });

  test('appendManualLearning with whitespace-only content returns false', () => {
    expect(appendManualLearning(cwd, 'agent', '   ')).toBe(false);
  });

  // appendManualLearning: directory already exists
  test('appendManualLearning works when learnings dir already exists', () => {
    const result = appendManualLearning(cwd, 'agent', 'some manual lesson');
    expect(result).toBe(true);
  });

  // appendManualLearning: directory does NOT exist → creates it
  test('appendManualLearning creates learnings dir if missing', () => {
    // Use a different workflow dir that has no learnings dir
    const fs = getFileSystem();
    const newCwd = '/tmp/new-workspace';
    fs.mkdirSync(path.join(newCwd, '.raili', 'main'), { recursive: true } as any);
    const result = appendManualLearning(newCwd, 'agent', 'a lesson', 'main');
    expect(result).toBe(true);
  });

  // appendUniqueLearning: directory does NOT exist → creates it
  test('appendUniqueLearning creates learnings dir if missing', () => {
    const fs = getFileSystem();
    const newCwd = '/tmp/new-workspace2';
    fs.mkdirSync(path.join(newCwd, '.raili', 'main'), { recursive: true } as any);
    const result = appendUniqueLearning(newCwd, 'agent', 'output:test', 'LESSON: hello', 'main');
    expect(result).toBe(true);
  });

  // readLearningsForPrompt: empty learnings → returns empty string
  test('readLearningsForPrompt returns empty string when no learnings file', () => {
    const result = readLearningsForPrompt(cwd, 'no-such-agent');
    expect(result).toBe('');
  });
});

