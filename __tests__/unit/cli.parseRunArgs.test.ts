import { parseRunArgs } from '../../src/cli';

describe('parseRunArgs', () => {
  test('recognizes --dry-run flag', () => {
    const res = parseRunArgs(['--dry-run', '-w', 'main']);
    expect(res.dryRun).toBe(true);
    expect(res.workflow).toBe('main');
  });

  test('parses --next=3 and forces continue mode', () => {
    const res = parseRunArgs(['--next=3']);
    expect(res.next).toBe(3);
    expect(res.mode).toBe('continue');
  });

  test('parses bare --next as 1 and forces continue mode', () => {
    const res = parseRunArgs(['--next']);
    expect(res.next).toBe(1);
    expect(res.mode).toBe('continue');
  });

  test('--next with --clean still forces continue mode', () => {
    const res = parseRunArgs(['--next=2', '--clean']);
    expect(res.next).toBe(2);
    expect(res.mode).toBe('continue');
  });

  test('parses --rollback=3 and returns rollback string and forces continue', () => {
    const res = parseRunArgs(['--rollback=3']);
    expect(res.rollback).toBe('3');
    expect(res.mode).toBe('continue');
  });

  test('parses --rollback=analyze and returns rollback string', () => {
    const res = parseRunArgs(['--rollback=analyze']);
    expect(res.rollback).toBe('analyze');
    expect(res.mode).toBe('continue');
  });

  test('bare --rollback forces continue mode without setting rollback value', () => {
    const res = parseRunArgs(['--rollback']);
    expect(res.mode).toBe('continue');
    expect(res.rollback).toBeUndefined();
  });
});
