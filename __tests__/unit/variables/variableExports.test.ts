import {parseExports} from '../../../src/variables/variableExports';

describe('parseExports', () => {
  test('parses simple name=value', () => {
    const out = 'id=123\nother=foo';
    const parsed = parseExports(out, ['id']);
    expect(parsed.id).toBe('123');
  });

  test('parses export prefix and quoted values', () => {
    const out = "export ID='456'\n";
    const parsed = parseExports(out, ['id']);
    expect(parsed.id).toBe('456');
  });

  test('is case-insensitive and trims whitespace', () => {
    const out = '  Id = \" 789 \"\n';
    const parsed = parseExports(out, ['id']);
    expect(parsed.id).toBe('789');
  });

  test('returns empty when not present', () => {
    const out = 'nothing here\n';
    const parsed = parseExports(out, ['id']);
    expect(parsed.id).toBeUndefined();
  });
});
