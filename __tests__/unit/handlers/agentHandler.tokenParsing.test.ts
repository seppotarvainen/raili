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

  test('returns undefined for malformed line', () => {
    expect(parseCopilotTokenLine('No tokens here')).toBeUndefined();
    expect(parseCopilotTokenLine('Tokens ↑ abc • ↓ xyz')).toBeUndefined();
  });
});
