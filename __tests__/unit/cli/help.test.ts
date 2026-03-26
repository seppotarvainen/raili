import { formatHelp } from '../../../src/cli/help';

describe('help formatting', () => {
  test('includes teach usage and hints', () => {
    const txt = formatHelp('teach');
    expect(txt).toContain('Usage: raili teach');
    expect(txt).toContain('/q');
    expect(txt).toContain('.raili');
  });
});
