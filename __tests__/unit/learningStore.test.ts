import { stripTimestampsFromLearnings, readLearningsForPrompt } from '../../src/context/learningStore';

describe('learningStore stripTimestampsFromLearnings', () => {
  // Single-line stored entries with literal "\\n" escapes for internal newlines
  const sample = `- [2026-03-23T19:00:00.000Z] [output:code] Lesson: Remember to run ` + '`npm run build`' + ` before tests.\\n\\nThis is a follow-up note.
- [2026-03-23T19:10:00.000Z] [var:ticket_id] Lesson: Ticket IDs should be validated for format PROJ-\\d+.
`;

  test('strips ISO timestamps and preserves source tags and lesson bodies', () => {
    const entries = stripTimestampsFromLearnings(sample);
    expect(entries.length).toBe(2);
    expect(entries[0]).toContain('[output:code]');
    expect(entries[0]).toContain('Lesson: Remember to run');
    expect(entries[1]).toContain('[var:ticket_id]');
    expect(entries[1]).toContain('Ticket IDs should be validated');
    // No ISO timestamps
    const combined = entries.join('\n\n');
    expect(combined).not.toMatch(/\d{4}-\d{2}-\d{2}T/);
  });
});
