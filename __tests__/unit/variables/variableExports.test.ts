import {parseExports} from '../../../src/variables/variableExports';

describe('parseExports', () => {
  test('parses simple name=value', () => {
    const out = 'id=123\nother=foo';
    const parsed = parseExports(out, ['id']);
    expect(parsed.id).toBe('123');
  });
  test('parses simple name=value multiple', () => {
    const out = 'id=123\nother=foo';
    const parsed = parseExports(out, ['id', 'other']);
    expect(parsed.id).toBe('123');
    expect(parsed.other).toBe('foo');
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

  test('returns empty when not present and multiple lines in output', () => {
    const out = 'nothing here\nnor here\n';
    const parsed = parseExports(out, ['id']);
    expect(parsed.id).toBeUndefined();
  });

  test('returns empty when not present and multiple exports', () => {
    const out = 'nothing here';
    const parsed = parseExports(out, ['id', 'other']);
    expect(parsed.id).toBeUndefined();
    expect(parsed.other).toBeUndefined();
  });

  test('parses stdout when only one line and variable present', () => {
    const out = 'ID123';
    const parsed = parseExports(out, ['id']);
    expect(parsed.id).toBe('ID123');
  });

  test('parses a single raw value with a trailing LF', () => {
    const parsed = parseExports('4f3c2a1b9d0e\n', ['commit_id']);
    expect(parsed).toEqual({commit_id: '4f3c2a1b9d0e'});
  });

  test('parses a single raw value with a trailing CRLF', () => {
    const parsed = parseExports('4f3c2a1b9d0e\r\n', ['commit_id']);
    expect(parsed).toEqual({commit_id: '4f3c2a1b9d0e'});
  });

  test('does not treat genuinely multiline raw output as a single value', () => {
    const parsed = parseExports('4f3c2a1b9d0e\nsecond-line\n', ['commit_id']);
    expect(parsed.commit_id).toBeUndefined();
  });
});
