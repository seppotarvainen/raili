import { parseCopilotTokenLine } from '../../../src/handlers/tokenParser';

describe('parseCopilotTokenLine', () => {
  test('parses typical line with cached', () => {
    const line = 'Tokens     ↑ 256.9k (223.0k cached) • ↓ 9.7k';
    const res = parseCopilotTokenLine(line);
    expect(res).toBeDefined();
    expect(res!.input).toBe(256900);
    expect(res!.cached).toBe(223000);
    expect(res!.output).toBe(9700);
    expect(res!.input_display).toBe('256.9k');
    expect(res!.cached_display).toBe('223.0k');
    expect(res!.output_display).toBe('9.7k');
  });

  test('parses line without cached', () => {
    const line = 'Tokens ↑ 1,234 • ↓ 56';
    const res = parseCopilotTokenLine(line);
    expect(res).toBeDefined();
    expect(res!.input).toBe(1234);
    expect(res!.cached).toBeUndefined();
    expect(res!.output).toBe(56);
  });

  test('parses M suffix and commas', () => {
    const line = 'Tokens ↑ 1.2M (100,000 cached) • ↓ 5k';
    const res = parseCopilotTokenLine(line);
    expect(res).toBeDefined();
    expect(res!.input).toBe(1200000);
    expect(res!.cached).toBe(100000);
    expect(res!.output).toBe(5000);
  });

  test('parses bug format with reasoning parenthesis', () => {
    const line = 'Tokens     ↑ 1.5m (1.4m cached) • ↓ 30.0k (6.4k reasoning)';
    const res = parseCopilotTokenLine(line);
    expect(res).toBeDefined();
    expect(res!.input).toBe(1500000);
    expect(res!.cached).toBe(1400000);
    expect(res!.output).toBe(30000);
    expect(res!.input_display).toBe('1.5m');
    expect(res!.cached_display).toBe('1.4m');
    expect(res!.output_display).toBe('30.0k');
  });

  test('parses tokens line embedded in multi-line output', () => {
    const multi = `Some logs\nInfo: starting\nTokens ↑ 2.0k (1.0k cached) • ↓ 10\nDone`;
    const res = parseCopilotTokenLine(multi);
    expect(res).toBeDefined();
    expect(res!.input).toBe(2000);
    expect(res!.cached).toBe(1000);
    expect(res!.output).toBe(10);
  });

  test('extracts AI Credits and merges with token parsing', () => {
    const multi = `Some logs\nTokens ↑ 256.9k (223.0k cached) • ↓ 9.7k\nAI Credits 0.72 (16s)`;
    const res = parseCopilotTokenLine(multi);
    expect(res).toBeDefined();
    expect(res!.input).toBe(256900);
    expect(res!.cached).toBe(223000);
    expect(res!.output).toBe(9700);
    expect(res!.ai_display).toBe('AI Credits 0.72 (16s)');
    expect(res!.ai_credits).toBeCloseTo(0.72);
    expect(res!.ai_time).toBe(16);
  });

  test('parses complex AI Credits time format', () => {
    const multi = `Header\nTokens ↑ 1k • ↓ 10\nAI Credits 0.5 (1h30m45s)`;
    const res = parseCopilotTokenLine(multi);
    expect(res).toBeDefined();
    expect(res!.input).toBe(1000);
    expect(res!.output).toBe(10);
    expect(res!.ai_credits).toBeCloseTo(0.5);
    expect(res!.ai_time).toBe(3600 + 30 * 60 + 45);
  });

  test('missing AI Credits leaves ai_* fields undefined', () => {
    const multi = `Logs\nTokens ↑ 2.0k (1.0k cached) • ↓ 10\nEnd`;
    const res = parseCopilotTokenLine(multi);
    expect(res).toBeDefined();
    expect(res!.ai_display).toBeUndefined();
    expect(res!.ai_credits).toBeUndefined();
    expect(res!.ai_time).toBeUndefined();
  });

  test('does not false-positive match unrelated numeric lines', () => {
    const line = 'Summary: files=10 tests=2 failures=0';
    expect(parseCopilotTokenLine(line)).toBeUndefined();
  });

  test('returns undefined for malformed line', () => {
    expect(parseCopilotTokenLine('No tokens here')).toBeUndefined();
    expect(parseCopilotTokenLine('Tokens ↑ abc • ↓ xyz')).toBeUndefined();
  });
});
