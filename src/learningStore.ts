import * as fs from 'fs';
import * as path from 'path';
import { learningsFilePath } from './pathUtils';

function normalizeForCompare(s: string): string {
  return s.replace(/\s+/g, ' ').trim().toLowerCase();
}

export function readLearnings(cwd: string, agentId: string, workflowArg?: string): string {
  const p = learningsFilePath(cwd, agentId, workflowArg);
  if (!fs.existsSync(p)) return '';
  return fs.readFileSync(p, 'utf8');
}

/**
 * Extract lessons from provided content. Rules:
 * - Find the first occurrence of the marker `lesson:` (case-insensitive)
 * - Return the substring after that first marker, preserving internal newlines and whitespace
 * - Subsequent occurrences of `lesson:` inside the lesson body are treated as literal text
 * - If no marker is present, return an empty array
 */
export function extractLessons(content: string): string[] {
  if (!content || !content.trim()) return [];
  const re = /lesson:/i;
  const m = re.exec(content);
  if (!m) return [];
  const start = m.index + m[0].length;
  let lesson = content.slice(start);
  // Trim leading/trailing blank lines/whitespace but preserve internal newlines
  lesson = lesson.replace(/^\s+/, '');
  lesson = lesson.replace(/\s+$/, '');
  return [lesson];
}

/**
 * Append one or more lessons extracted from `content` if they are not already present.
 * Returns true if any new lesson was appended, false otherwise.
 * Unmarked content is ignored (not persisted).
 */
export function appendUniqueLearning(
  cwd: string,
  agentId: string,
  sourceTag: string,
  content: string,
  workflowArg?: string,
): boolean {
  if (!content || !content.trim()) return false;

  const lessons = extractLessons(content);
  if (!lessons.length) return false; // nothing to store

  const p = learningsFilePath(cwd, agentId, workflowArg);
  let existing = '';
  if (fs.existsSync(p)) {
    existing = fs.readFileSync(p, 'utf8');
  }
  const normalizedExisting = normalizeForCompare(existing);

  // Ensure directory exists
  const dir = path.dirname(p);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  let appendedAny = false;
  const timestamp = new Date().toISOString();

  for (const lesson of lessons) {
    const normalizedNew = normalizeForCompare(lesson);
    if (normalizedExisting.includes(normalizedNew) && normalizedNew.length > 0) {
      continue; // already present
    }

    // Store as a block to preserve multiline content
    const entry = `- [${timestamp}] [${sourceTag}]\n\n${lesson.trim()}\n\n`;
    fs.appendFileSync(p, entry, 'utf8');
    appendedAny = true;
  }

  return appendedAny;
}
