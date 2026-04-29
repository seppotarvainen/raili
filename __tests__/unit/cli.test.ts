import { parseRunArgs } from '../../src/cli';

describe('parseRunArgs --resolve-vars handling', () => {
  test('flag absent results in undefined', () => {
    const parsed = parseRunArgs([]);
    expect(parsed.resolveVars).toBeUndefined();
  });

  test('--resolve-vars with no args returns empty array', () => {
    const parsed = parseRunArgs(['--resolve-vars']);
    expect(parsed.resolveVars).toEqual([]);
  });

  test('--resolve-vars with single value', () => {
    const parsed = parseRunArgs(['--resolve-vars', 'key=val']);
    expect(parsed.resolveVars).toEqual(['key=val']);
  });

  test('--resolve-vars with multiple values', () => {
    const parsed = parseRunArgs(['--resolve-vars', 'a', 'b', 'c']);
    expect(parsed.resolveVars).toEqual(['a', 'b', 'c']);
  });
});
