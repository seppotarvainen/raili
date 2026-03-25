import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {appendUniqueLearning, extractLessons, readLearnings, stripTimestampsFromLearnings} from '../../../src/context/learningStore';

describe('learningStore extractLessons', () => {
  test('single marker extracts following section and escapes internal newlines', () => {
    const input = 'Intro text\nLESSON: This is line1\nThis is line2\n';
    const lessons = extractLessons(input);
    expect(lessons.length).toBe(1);
    // internal newline must be escaped as two-character sequence \n
    expect(lessons[0]).toContain('This is line1\\nThis is line2');
    // no real newline characters in returned lesson
    expect(lessons[0].includes('\n')).toBe(false);
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

  test('persists marked multiline lesson and always appends (no dedupe)', () => {
    const agentId = 'my-agent';
    const content = 'Header info\nLESSON: Line1\nLine2\n';
    const appended = appendUniqueLearning(cwd, agentId, 'output:test', content);
    expect(appended).toBe(true);
    // uniqueness check removed — subsequent identical inputs are appended as well
    const again = appendUniqueLearning(cwd, agentId, 'output:test', content);
    expect(again).toBe(true);
    const stored = readLearnings(cwd, agentId);
    // stored entries are single physical lines that include the literal '\\n' escape
    expect(stored).toContain('Line1\\nLine2');
    expect(stored.includes('\\n')).toBe(true);
  });
});

// ── stripTimestampsFromLearnings ──────────────────────────────────────────────

describe('learningStore stripTimestampsFromLearnings', () => {
  test('entry with source tag includes source prefix and decodes \\n sequences', () => {
    const content = '- [2026-01-01T00:00:00Z] [output:analyze] Lesson line1\\nLine2\n';
    const entries = stripTimestampsFromLearnings(content);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toContain('[output:analyze]');
    // decoded newlines should be real newlines in returned entry
    expect(entries[0].includes('\n')).toBe(true);
    expect(entries[0]).not.toContain('\\n');
  });

  test('entry WITHOUT source tag returns decoded bare lesson', () => {
    const content = '- [2026-01-01T00:00:00Z] Bare\\nMore\n';
    const entries = stripTimestampsFromLearnings(content);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toBe('Bare\nMore');
    expect(entries[0]).not.toContain('[');
  });

  test('empty content returns empty array', () => {
    expect(stripTimestampsFromLearnings('')).toEqual([]);
    expect(stripTimestampsFromLearnings('   ')).toEqual([]);
  });
});

