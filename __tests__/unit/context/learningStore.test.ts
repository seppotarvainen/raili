import * as path from 'path';
import { setupFakeFs } from '../infrastructure/fsFake.util';
import { getFileSystem } from '../../../src/infrastructure/fileSystemProvider';
import {
    appendUniqueLearning,
    extractLessons,
    readLearnings,
    stripTimestampsFromLearnings,
    readMergedLearnings,
    readMergedLearningsForPrompt
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
        expect(entries[0]).toContain('Remember to run');
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

// ── New tests: merging/deduplication and scope routing ─────────────────────────

describe('readMergedLearnings and prompt-ready merged output', () => {
    let cwd: string;
    let restoreFs: () => void;

    beforeEach(() => {
        restoreFs = setupFakeFs();
        cwd = '/tmp/merge-workspace';
        // ensure both global and workflow learnings dirs exist
        getFileSystem().mkdirSync(path.join(cwd, '.raili', 'learnings'), { recursive: true } as any);
        getFileSystem().mkdirSync(path.join(cwd, '.raili', 'main', 'learnings'), { recursive: true } as any);
    });

    afterEach(() => {
        restoreFs();
    });

    test('readMergedLearnings merges global + workflow and workflow overrides duplicates', () => {
        const agentId = 'agent-merge';
        const globalPath = path.join(cwd, '.raili', 'learnings', `${agentId}.md`);
        const workflowPath = path.join(cwd, '.raili', 'main', 'learnings', `${agentId}.md`);

        // Global has a common lesson and a global-only lesson
        const globalContent =
            '- [2026-01-01T00:00:00Z] [output:global] lesson: This is common\\nMore\n' +
            '- [2026-01-02T00:00:00Z] [output:global] lesson: Global only\n';
        getFileSystem().writeFileSync(globalPath, globalContent, 'utf8');

        // Workflow has a common lesson (should override global) and a workflow-only lesson
        const workflowContent =
            '- [2026-01-03T00:00:00Z] [output:wf] lesson: This is common\n' +
            '- [2026-01-04T00:00:00Z] [output:wf] lesson: Workflow only\n';
        getFileSystem().writeFileSync(workflowPath, workflowContent, 'utf8');

        const merged = readMergedLearnings(cwd, agentId, 'main');
        const mergedLines = merged.split(/\r?\n/).filter(Boolean);
        // Expect global-only first, then workflow lines (common + workflow-only)
        expect(mergedLines).toHaveLength(3);
        expect(mergedLines[0]).toContain('Global only');
        expect(mergedLines[1]).toContain('This is common');
        expect(mergedLines[2]).toContain('Workflow only');
    });

    test('readMergedLearningsForPrompt returns bullet list with timestamps stripped', () => {
        const agentId = 'agent-merge-2';
        const globalPath = path.join(cwd, '.raili', 'learnings', `${agentId}.md`);
        const workflowPath = path.join(cwd, '.raili', 'main', 'learnings', `${agentId}.md`);

        const globalContent = '- [2026-01-01T00:00:00Z] [output:g] lesson: G1\\nLine';
        const workflowContent = '- [2026-01-02T00:00:00Z] [output:w] lesson: W1';
        getFileSystem().writeFileSync(globalPath, globalContent, 'utf8');
        getFileSystem().writeFileSync(workflowPath, workflowContent, 'utf8');

        const promptReady = readMergedLearningsForPrompt(cwd, agentId, 'main');
        // Should include bullet lines without ISO timestamps and without source tags
        expect(promptReady).toContain('- G1');
        expect(promptReady).toContain('- W1');
        expect(promptReady).not.toMatch(/\d{4}-\d{2}-\d{2}T/);
    });
});

describe('appendUniqueLearning scope routing', () => {
    let cwd: string;
    let restoreFs: () => void;

    beforeEach(() => {
        restoreFs = setupFakeFs();
        cwd = '/tmp/scope-workspace';
        // ensure both possible target dirs exist
        getFileSystem().mkdirSync(path.join(cwd, '.raili', 'learnings'), { recursive: true } as any);
        getFileSystem().mkdirSync(path.join(cwd, '.raili', 'main', 'learnings'), { recursive: true } as any);
    });

    afterEach(() => {
        restoreFs();
    });

    test('scope=global writes to .raili/learnings', () => {
        const agentId = 'agent-scope';
        const added = appendUniqueLearning(cwd, agentId, 'source:unit', 'LESSON: Global write test', undefined, 'global');
        expect(added).toBe(true);
        const p = path.join(cwd, '.raili', 'learnings', `${agentId}.md`);
        expect(getFileSystem().existsSync(p)).toBe(true);
        const stored = getFileSystem().readFileSync(p, 'utf8');
        expect(stored).toContain('Global write test');
    });

    test('scope=workflow writes to workflow learnings dir', () => {
        const agentId = 'agent-scope-wf';
        const added = appendUniqueLearning(cwd, agentId, 'source:unit', 'LESSON: Workflow write test', 'main', 'workflow');
        expect(added).toBe(true);
        const p = path.join(cwd, '.raili', 'main', 'learnings', `${agentId}.md`);
        expect(getFileSystem().existsSync(p)).toBe(true);
        const stored = getFileSystem().readFileSync(p, 'utf8');
        expect(stored).toContain('Workflow write test');
    });
});

// Types test appended below

describe('types: LearnSource scope optional', () => {
  test('LearnSource accepts objects with and without scope', () => {
    // Type-level check: these should compile
    const a: import('../../../src/types').LearnSource = { output: 'state' };
    const b: import('../../../src/types').LearnSource = { var: 'ticket_id', scope: 'workflow' };
    expect(a).toBeDefined();
    expect(b).toBeDefined();
  });
});
