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
  return res;
}

