import * as path from 'path';
import { setupFakeFs } from '../infrastructure/fsFake.util';
import { getFileSystem } from '../../../src/infrastructure/fileSystemProvider';
import {
    appendUniqueLearning,
    extractLessons,
    readLearnings,
    stripTimestampsFromLearnings
} from '../../../src/context/learningStore';

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

    let restoreFs: () => void;
    beforeEach(() => {
        restoreFs = setupFakeFs();
        cwd = '/tmp/test-workspace';
        learningsDir = path.join(cwd, '.raili', 'main', 'learnings');
        getFileSystem().mkdirSync(learningsDir, {recursive: true} as any);
    });

    afterEach(() => {
        restoreFs();
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
    test('entry with source tag does NOT include source prefix and decodes \\n sequences', () => {
        const content = '- [2026-01-01T00:00:00Z] [output:analyze] Lesson line1\\nLine2\n';
        const entries = stripTimestampsFromLearnings(content);
        expect(entries).toHaveLength(1);
        expect(entries[0]).not.toContain('[output:analyze]');
        // decoded newlines should be real newlines in returned entry
        expect(entries[0].includes('\n')).toBe(true);
        expect(entries[0]).not.toContain('\\n');
        expect(entries[0]).toContain('- Lesson line1');
    });

    test('strips ISO timestamps and removes source tags while preserving lesson bodies', () => {
        const sample = `- [2026-03-23T19:00:00.000Z] [output:code] Lesson: Remember to run ` + '`npm run build`' + ` before tests.\\n\\nThis is a follow-up note.
- [2026-03-23T19:10:00.000Z] [var:ticket_id] Lesson: Ticket IDs should be validated for format PROJ-\\d+.
`
        const entries = stripTimestampsFromLearnings(sample);
        expect(entries.length).toBe(2);
        expect(entries[0]).not.toContain('[output:code]');
        expect(entries[0]).toContain('Lesson: Remember to run');
        expect(entries[1]).not.toContain('[var:ticket_id]');
        expect(entries[1]).toContain('Ticket IDs should be validated');
        // No ISO timestamps
        const combined = entries.join('\n\n');
        expect(combined).not.toMatch(/\d{4}-\d{2}-\d{2}T/);
    });

    test('entry WITHOUT source tag returns decoded bare lesson with bullet', () => {
        const content = '- [2026-01-01T00:00:00Z] Bare\\nMore\n';
        const entries = stripTimestampsFromLearnings(content);
        expect(entries).toHaveLength(1);
        expect(entries[0]).toBe('- Bare\n  More');
        expect(entries[0]).not.toContain('[');
    });

    test('empty content returns empty array', () => {
        expect(stripTimestampsFromLearnings('')).toEqual([]);
        expect(stripTimestampsFromLearnings('   ')).toEqual([]);
    });
});

