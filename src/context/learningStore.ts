import { getFileSystem } from '../infrastructure/fileSystemProvider';
import * as path from 'path';
import { learningsFilePath } from './pathUtils';

type LearningsScope = 'global' | 'workflow';

function normalizeForCompare(s: string): string {
  return s.replace(/\s+/g, ' ').trim().toLowerCase();
}

/**
 * Read raw learnings file content for given scope. Default scope = 'global'.
 */
export function readLearnings(
  cwd: string,
  agentId: string,
  workflowArg?: string,
  scope?: LearningsScope,
): string {
  const fs = getFileSystem();
  // Default to workflow scope when workflowArg provided; otherwise global.
  const effectiveScope: LearningsScope = scope ?? (workflowArg ? 'workflow' : 'global');
  const p = learningsFilePath(cwd, agentId, workflowArg, effectiveScope);
  if (!fs.existsSync(p)) {
    return '';
  }
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
  if (!content?.trim()) {
    return [];
  }
  const re = /lesson:/i;
  const m = re.exec(content);
  if (!m) {
    return [];
  }
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
  if (!content?.trim()) {
    return [];
  }

  // Line-oriented parser: each lesson is stored as a single physical line:
  // - [TIMESTAMP] [OPTIONAL_SOURCE] <lesson-with-\\n-escapes>
  const lines = content.split(/\r?\n/);
  const results: string[] = [];
  const re = /^- \[([^\]]+)\](?: \[([^\]]+)\])? (.*)$/;
  for (const line of lines) {
    const m = re.exec(line);
    if (!m) {
      continue;
    }
    // const source = m[2];
    let lessonEscaped = m[3] || '';
    lessonEscaped = lessonEscaped.trim();
    // Decode literal "\\n" sequences back to real newlines for prompt consumption
    let decoded = lessonEscaped.replace(/\\n/g, '\n');
    // Remove any leading 'lesson:' marker (case-insensitive) to keep bullets clean
    decoded = decoded.replace(/^\s*lesson:\s*/i, '');
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
export function readLearningsForPrompt(
  cwd: string,
  agentId: string,
  workflowArg?: string,
  scope?: LearningsScope,
): string {
  // Delegate scope resolution to readLearnings (it prefers workflow when .raili/main exists)
  const raw = readLearnings(cwd, agentId, workflowArg, scope);
  const entries = stripTimestampsFromLearnings(raw);
  if (!entries.length) {
    return '';
  }
  return entries.join('\n\n');
}

/**
 * Read both global and workflow-scoped learnings and merge them. Workflow-scoped lessons win
 * (i.e., if the same normalized lesson exists in both, the workflow version is kept).
 * Returns merged raw file content (line-oriented format).
 */
export function readMergedLearnings(cwd: string, agentId: string, workflowArg?: string): string {
  const globalRaw = readLearnings(cwd, agentId, workflowArg, 'global');
  const workflowRaw = readLearnings(cwd, agentId, workflowArg, 'workflow');

  // Parse lines into normalized map
  const parseLines = (raw: string) => {
    if (!raw) return [] as { rawLine: string; normalized: string }[];
    const lines = raw.split(/\r?\n/);
    const re = /^- \[[^\]]+\](?: \[[^\]]+\])? (.*)$/;
    const out: { rawLine: string; normalized: string }[] = [];
    for (const line of lines) {
      const m = re.exec(line);
      if (!m) continue;
      const lessonEscaped = (m[1] || '').trim();
      const decoded = lessonEscaped.replace(/\\n/g, '\n');
      const normalized = normalizeForCompare(decoded.replace(/\n/g, ' '));
      out.push({ rawLine: line, normalized });
    }
    return out;
  };

  const workflowLines = parseLines(workflowRaw);
  const globalLines = parseLines(globalRaw);

  // Build list of workflow normalized lessons for override detection
  const workflowNorms = workflowLines.map((l) => l.normalized);

  const merged: string[] = [];
  // Include global lines that are not overridden by any workflow-normalized lesson
  for (const g of globalLines) {
    const isOverridden = workflowNorms.some((w) => {
      return w === g.normalized || w.includes(g.normalized) || g.normalized.includes(w);
    });
    if (!isOverridden) {
      merged.push(g.rawLine);
    }
  }
  // Then include workflow lines (preserve order)
  for (const w of workflowLines) {
    merged.push(w.rawLine);
  }

  return merged.join('\n');
}

/**
 * Like readMergedLearnings but returns a prompt-ready string with timestamps stripped and
 * lessons formatted as bullet points. Returns empty string when no lessons.
 */
export function readMergedLearningsForPrompt(
  cwd: string,
  agentId: string,
  workflowArg?: string,
): string {
  const mergedRaw = readMergedLearnings(cwd, agentId, workflowArg);
  const entries = stripTimestampsFromLearnings(mergedRaw);
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
  scope?: LearningsScope,
): boolean {
  if (!content?.trim()) {
    return false;
  }

  const lessons = extractLessons(content);
  if (!lessons.length) {
    return false;
  } // nothing to store

  const fs = getFileSystem();
  // Default to global scope unless explicitly requested otherwise
  const effectiveScope: LearningsScope = scope ?? 'global';
  const p = learningsFilePath(cwd, agentId, workflowArg, effectiveScope);

  // Ensure directory exists
  const dir = path.dirname(p);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

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
  scope?: LearningsScope,
): boolean {
  if (!content?.trim()) {
    return false;
  }

  const fs = getFileSystem();
  // Default to global scope unless explicitly requested otherwise
  const effectiveScope: LearningsScope = scope ?? 'global';
  const p = learningsFilePath(cwd, agentId, workflowArg, effectiveScope);

  const dir = path.dirname(p);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const timestamp = new Date().toISOString();
  // Escape internal newlines as literal "\\n" so each lesson is one physical line
  const escaped = content.trim().replace(/\r\n/g, '\n').replace(/\n/g, '\\n');
  const entry = `- [${timestamp}] [manual] ${escaped}\n`;
  fs.appendFileSync(p, entry, 'utf8');
  return true;
}
