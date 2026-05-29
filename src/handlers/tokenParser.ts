import { TokenUsage } from '../types';

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

export function parseCopilotTokenLine(text: string): TokenUsage | undefined {
  if (!text) return undefined;

  const arrowRegex =
    /↑\s*([0-9.,]+(?:[kKmM])?)(?:\s*\(\s*([0-9.,]+(?:[kKmM])?)\s*cached\s*\))?.*?↓\s*([0-9.,]+(?:[kKmM])?)/is;
  const m = arrowRegex.exec(text);
  if (m) {
    const input_display = m[1];
    const cached_display = m[2];
    const output_display = m[3];
    const input = parseNumberString(input_display);
    const cached = parseNumberString(cached_display);
    const output = parseNumberString(output_display);
    if (input === undefined || output === undefined) return undefined;
    const res: TokenUsage = { input, output, input_display, output_display };
    if (cached !== undefined) {
      res.cached = cached;
      res.cached_display = cached_display;
    }
    return res;
  }

  const fallbackRegex =
    /([0-9.,]+(?:[kKmM])?)\s*(?:\(\s*([0-9.,]+(?:[kKmM])?)\s*cached\s*\))?.*?([0-9.,]+(?:[kKmM])?)/;
  const m2 = fallbackRegex.exec(text);
  if (m2) {
    const input_display = m2[1];
    const cached_display = m2[2];
    const output_display = m2[3];
    const input = parseNumberString(input_display);
    const cached = parseNumberString(cached_display);
    const output = parseNumberString(output_display);
    if (input === undefined || output === undefined) return undefined;
    const res: TokenUsage = { input, output, input_display, output_display };
    if (cached !== undefined) {
      res.cached = cached;
      res.cached_display = cached_display;
    }
    return res;
  }

  return undefined;
}
