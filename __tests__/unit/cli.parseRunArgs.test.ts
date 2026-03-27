import { parseRunArgs } from '../../src/cli';

describe('parseRunArgs', () => {
  test('recognizes --dry-run flag', () => {
    const res = parseRunArgs(['--dry-run', '-w', 'main']);
    expect(res.dryRun).toBe(true);
    expect(res.workflow).toBe('main');
  });
});
