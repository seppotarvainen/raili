import { formatHelp } from '../../../src/cli/help';

describe('help formatting', () => {
  test('returns usage documentation when called without arguments', () => {
    const out = formatHelp();
    expect(out).toContain('Help you asked');
    expect(out).toContain('## Usage');
    expect(out).not.toContain('# help');
  });

  test('returns usage documentation for raili help <command>', () => {
    const out = formatHelp(undefined, 'run');
    expect(out).toContain('Validate and execute');
    expect(out).toContain('## Usage');
    expect(out).not.toContain('## Examples');
    expect(out).not.toContain('# run');
  });

  test('returns usage documentation for raili <command> --help', () => {
    const out = formatHelp('create');
    expect(out).toContain('## Usage');
    expect(out).not.toContain('# create');
    expect(out).not.toContain('## Description');
  });

  test('returns helpful error message for unknown command', () => {
    const out = formatHelp('nonexistent_command');
    expect(out).toContain('Unknown command: nonexistent_command');
    expect(out).toContain('Get help with `raili help` or `raili --help`.');
    expect(out).not.toContain('Usage: raili [--version] <command> [options]');
  });

  test('returns helpful error message for unknown topic', () => {
    const out = formatHelp(undefined, 'nonexistent_topic');
    expect(out).toContain('Unknown topic: nonexistent_topic');
    expect(out).toContain('Get help with `raili help` or `raili --help`.');
  });

  test('falls back to HELP_TOPICS for non-usage topics', () => {
    const out = formatHelp(undefined, 'routing');
    expect(out).toContain('EXACTLY ONE');
  });

  test('includes teach usage and hints (legacy)', () => {
    const txt = formatHelp('teach');
    expect(txt).toContain('Usage: raili teach');
    expect(txt).toContain('/q');
    expect(txt).toContain('.raili');
  });
});
