import { TokenUsage } from '../types';

/**
 * Parse a number string like "256.9k", "1.2M", "1,234", "10" into a numeric value.
 */
function parseNumberString(s: string | undefined): number | undefined {
  if (!s) return undefined;
  const cleaned = s.replace(/,/g, '').trim();
  const m = cleaned.match(/^([0-9]+(?:\.[0-9]+)?)([kKmM])?$/);
  if (!m) return undefined;
  const num = parseFloat(m[1]);
  const suffix = m[2]?.toLowerCase();
  const mult = suffix === 'k' ? 1e3 : suffix === 'm' ? 1e6 : 1;
  return Math.round(num * mult);
}

/**
 * Parse a parenthesized annotation like "(223.0k cached)" or "(6.4k reasoning)".
 * Returns the display string (e.g. "223.0k") or undefined if not present.
 */
function parseParenValue(segment: string, label: string): string | undefined {
  const re = new RegExp(`\\(\\s*([0-9.,]+[kKmM]?)\\s+${label}\\s*\\)`);
  const m = re.exec(segment);
  return m ? m[1] : undefined;
}

/**
 * Parse a duration string like "1h30m45s" or "16s" into total seconds.
 * Returns 0 for empty or invalid strings.
 */
export function parseTimeDuration(timeStr: string): number {
  if (!timeStr) return 0;
  const s = timeStr.trim();
  if (!s) return 0;

  let total = 0;
  const re = /(\d+)\s*([hms])/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s)) !== null) {
    const val = parseInt(m[1], 10);
    const unit = m[2].toLowerCase();
    if (unit === 'h') total += val * 3600;
    else if (unit === 'm') total += val * 60;
    else if (unit === 's') total += val;
  }
  return total;
}

/**
 * Parse an "AI Credits" footer line and extract ai_display, ai_credits (number) and ai_time (seconds).
 * Looks for the last line containing an "AI Credits" pattern like:
 *   AI Credits 0.72 (16s)
 *   AI Credits 0.5 (1h30m45s)
 */
export function parseAICreditsLine(
  text: string,
): { ai_display: string; ai_credits: number; ai_time: number } | undefined {
  if (!text) return undefined;
  const lines = text.split('\n');
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i].trim();
    // Try to match: AI Credits <number> (<time-spec>)
    const re = /AI Credits\s+([0-9]*\.?[0-9]+)\s*\(([^)]+)\)/i;
    const m = re.exec(line);
    if (m) {
      const credits = parseFloat(m[1]);
      const timeStr = m[2];
      const seconds = parseTimeDuration(timeStr);
      return { ai_display: m[0], ai_credits: isNaN(credits) ? 0 : credits, ai_time: seconds };
    }
  }
  return undefined;
}

/**
 * Find the last line starting with "Tokens" in the text, then parse:
 *   ↑ <input> (<cached> cached) • ↓ <output> (<reasoning> reasoning)
 *
 * Cached and reasoning parts are optional.
 */
export function parseCopilotTokenLine(text: string): TokenUsage | undefined {
  if (!text) return undefined;

  // Find last line that starts with "Tokens"
  const lines = text.split('\n');
  let tokenLine: string | undefined;
  for (let i = lines.length - 1; i >= 0; i--) {
    if (lines[i].trimStart().startsWith('Tokens')) {
      tokenLine = lines[i];
      break;
    }
  }
  if (!tokenLine) return undefined;

  // Split by arrows: we expect ↑ ... ↓ ...
  const upIdx = tokenLine.indexOf('↑');
  const downIdx = tokenLine.indexOf('↓');
  if (upIdx === -1 || downIdx === -1 || downIdx <= upIdx) return undefined;

  const upSegment = tokenLine.slice(upIdx + 1, downIdx);
  const downSegment = tokenLine.slice(downIdx + 1);

  // Parse input: first number token after ↑
  const inputMatch = upSegment.match(/([0-9][0-9.,]*[kKmM]?)/);
  if (!inputMatch) return undefined;
  const input_display = inputMatch[1];
  const input = parseNumberString(input_display);
  if (input === undefined) return undefined;

  // Parse cached (optional): "(NNN cached)"
  const cached_display = parseParenValue(upSegment, 'cached');
  const cached = parseNumberString(cached_display);

  // Parse output: first number token after ↓
  const outputMatch = downSegment.match(/([0-9][0-9.,]*[kKmM]?)/);
  if (!outputMatch) return undefined;
  const output_display = outputMatch[1];
  const output = parseNumberString(output_display);
  if (output === undefined) return undefined;

  const res: TokenUsage = { input, output, input_display, output_display };
  if (cached !== undefined) {
    res.cached = cached;
    res.cached_display = cached_display;
  }

  // Merge AI Credits info when present (search entire text for last AI Credits line)
  const ai = parseAICreditsLine(text);
  if (ai) {
    res.ai_display = ai.ai_display;
    res.ai_credits = ai.ai_credits;
    res.ai_time = ai.ai_time;
  }

  return res;
}
