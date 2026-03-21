import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {appendUniqueLearning, extractLessons, readLearnings} from '../../src/context/learningStore';

describe('learningStore extractLessons', () => {
  test('single marker extracts following section preserving newlines', () => {
    const input = 'Intro text\nLESSON: This is line1\nThis is line2\n';
    const lessons = extractLessons(input);
    expect(lessons.length).toBe(1);
    expect(lessons[0]).toContain('This is line1');
    expect(lessons[0]).toContain('This is line2');
    expect(lessons[0].includes('\n')).toBe(true);
  });

  test('multiple markers: only first is considered a marker', () => {
    const input = 'lesson: First part\nDetails\nLESSON: Not a real marker\nEnd';
    const lessons = extractLessons(input);
    expect(lessons.length).toBe(1);
    expect(lessons[0]).toContain('First part');
    expect(lessons[0]).toContain('LESSON: Not a real marker');
  });

  test('no markers returns empty array', () => {
    const input = 'No lessons here';
    const lessons = extractLessons(input);
    expect(lessons.length).toBe(0);
  });

  test('case variations of marker are supported', () => {
    const input = '  LeSsOn: Mixed case supported\ncontent';
    const lessons = extractLessons(input);
    expect(lessons.length).toBe(1);
    expect(lessons[0]).toContain('Mixed case supported');
  });

  test('surrounding whitespace handled', () => {
    const input = '  \n  LESSON:   \n  spaced content  \n ';
    const lessons = extractLessons(input);
    expect(lessons.length).toBe(1);
    expect(lessons[0].trim()).toBe('spaced content');
  });
});

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

  test('does not persist unmarked content', () => {
    const agentId = 'my-agent';
    const appended = appendUniqueLearning(cwd, agentId, 'output:test', 'Something happened');
    expect(appended).toBe(false);
    const content = readLearnings(cwd, agentId);
    expect(content).toBe('');
  });

  test('persists marked multiline lesson and deduplicates', () => {
    const agentId = 'my-agent';
    const content = 'Header info\nLESSON: Line1\nLine2\n';
    const appended = appendUniqueLearning(cwd, agentId, 'output:test', content);
    expect(appended).toBe(true);
    const again = appendUniqueLearning(cwd, agentId, 'output:test', content);
    expect(again).toBe(false);
    const stored = readLearnings(cwd, agentId);
    expect(stored).toContain('Line1');
    expect(stored).toContain('Line2');
    // ensure internal newlines preserved in stored content
    expect(stored.includes('\n')).toBe(true);
  });
});
