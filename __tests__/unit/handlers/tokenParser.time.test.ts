import { parseTimeDuration } from '../../../src/handlers/tokenParser';

describe('parseTimeDuration', () => {
  test.each([
    ['16s', 16],
    ['1h', 3600],
    ['30m', 1800],
    ['1h30m45s', 5445],
    ['2m30s', 150],
    [' 1h  2m ', 3720],
    ['', 0],
    ['invalid', 0],
  ])('parses "%s" -> %i', (input, expected) => {
    expect(parseTimeDuration(input as string)).toBe(expected as number);
  });
});
