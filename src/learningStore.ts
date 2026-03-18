import * as fs from 'fs';
import * as path from 'path';
import { learningsFilePath } from './pathUtils';

function normalizeForCompare(s: string): string {
  return s.replace(/\s+/g, ' ').trim().toLowerCase();
}

export function readLearnings(cwd: string, agentId: string): string {
  const p = learningsFilePath(cwd, agentId);
  if (!fs.existsSync(p)) return '';
  return fs.readFileSync(p, 'utf8');
}

/**
 * Append a new learning line if it is not already present (dedupe by normalized substring match).
 * Returns true if appended, false if skipped.
 */
export function appendUniqueLearning(
  cwd: string,
  agentId: string,
  sourceTag: string,
  content: string,
): boolean {
  const p = learningsFilePath(cwd, agentId);
  const normalizedNew = normalizeForCompare(content);

  let existing = '';
  if (fs.existsSync(p)) {
    existing = fs.readFileSync(p, 'utf8');
  }
  const normalizedExisting = normalizeForCompare(existing);

  if (normalizedExisting.includes(normalizedNew) && normalizedNew.length > 0) {
    return false; // already present
  }

  // Ensure directory exists
  const dir = path.dirname(p);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const timestamp = new Date().toISOString();
  // Replace newlines in content with single spaces to keep learnings one-line
  const singleLine = content.replace(/\s+/g, ' ').trim();
  const entry = `- [${timestamp}] [${sourceTag}] ${singleLine}\n`;
  fs.appendFileSync(p, entry, 'utf8');
  return true;
}
