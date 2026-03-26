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
  // Trim surrounding whitespace
  lesson = lesson.replace(/^\s+/, '');
  lesson = lesson.replace(/\s+$/, '');
  lesson = lesson.trim();
  // Normalize CRLF to LF then escape internal newlines as two-character sequence "\\n"
  const escaped = lesson.replace(/\r\n/g, '\n').replace(/\n/g, '\\n');
  return [escaped];
}

/**
 * Strip ISO timestamps from a learnings file content and return an array of cleaned entry strings.
 * Each returned entry will optionally start with a compact source tag (e.g. "[output:state]") on its own
 * line followed by the lesson body. Internal newlines of lessons are preserved.
 */
export function stripTimestampsFromLearnings(content: string): string[] {
  if (!content || !content.trim()) return [];

  // Line-oriented parser: each lesson is stored as a single physical line:
  // - [TIMESTAMP] [OPTIONAL_SOURCE] <lesson-with-\\n-escapes>
  const lines = content.split(/\r?\n/);
  const results: string[] = [];
  const re = /^- \[([^\]]+)\](?: \[([^\]]+)\])? (.*)$/;
  for (const line of lines) {
    const m = re.exec(line);
    if (!m) continue;
    // const source = m[2];
    let lessonEscaped = m[3] || '';
    lessonEscaped = lessonEscaped.trim();
    // Decode literal "\\n" sequences back to real newlines for prompt consumption
    const decoded = lessonEscaped.replace(/\\n/g, '\n');
    // Strip source tags entirely for prompt consumption. Only return the lesson body.
    // Prepend a dash to mimic a bullet point used in examples/communication.
    // Preserve multiline lesson bodies.
    const withBullet = decoded
      .split('\n')
      .map((line, idx) => (idx === 0 ? `- ${line}` : `  ${line}`))
      .join('\n');
    results.push(withBullet);
  }
  return results;
}

/**
 * Read learnings from disk and return a concatenated, timestamp-stripped string suitable for
 * injecting into agent prompts. This preserves lesson bodies and optional source tags while
 * removing noisy ISO timestamps to save tokens.
 */
export function readLearningsForPrompt(cwd: string, agentId: string, workflowArg?: string): string {
  const raw = readLearnings(cwd, agentId, workflowArg);
  const entries = stripTimestampsFromLearnings(raw);
  if (!entries.length) return '';
  return entries.join('\n\n');
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

  // Ensure directory exists
  const dir = path.dirname(p);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  let appendedAny = false;
  const timestamp = new Date().toISOString();

  for (const lesson of lessons) {
    // Store as single-line entry with literal "\\n" escapes for internal newlines
    const entry = `- [${timestamp}] [${sourceTag}] ${lesson.trim()}\n`;
    fs.appendFileSync(p, entry, 'utf8');
    appendedAny = true;
  }

  return appendedAny;
}

export function appendManualLearning(
  cwd: string,
  agentId: string,
  content: string,
  workflowArg?: string,
): boolean {
  if (!content || !content.trim()) return false;

  const p = learningsFilePath(cwd, agentId, workflowArg);

  const dir = path.dirname(p);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const timestamp = new Date().toISOString();
  // Escape internal newlines as literal "\\n" so each lesson is one physical line
  const escaped = content.trim().replace(/\r\n/g, '\n').replace(/\n/g, '\\n');
  const entry = `- [${timestamp}] [manual] ${escaped}\n`;
  fs.appendFileSync(p, entry, 'utf8');
  return true;
}
