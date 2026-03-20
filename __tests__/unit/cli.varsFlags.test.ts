import { parseRunArgs } from '../../src/cli';

describe('parseRunArgs --var merging', () => {
  test('repeated --var entries override earlier ones', () => {
    const argv = ['--var', 'a=1', '--var', 'b=2', '--var', 'a=3'];
    const res = parseRunArgs(argv as any);
    expect(res.vars).toEqual({ a: '3', b: '2' });
  });
});
