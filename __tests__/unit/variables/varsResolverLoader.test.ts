import { parseResolveVarsArgs, loadVarsResolver, executeVarsResolver } from '../../../src/variables/varsResolverLoader';
import { VarsResolverInput, VarsResolverFn } from '../../../src/types';

describe('parseResolveVarsArgs', () => {
  test('parses named arguments', () => {
    const raw = ['card_id=12345', 'env=prod'];
    const { namedArgs, positionalArgs } = parseResolveVarsArgs(raw);
    expect(namedArgs).toEqual({ card_id: '12345', env: 'prod' });
    expect(positionalArgs).toEqual([]);
  });

  test('parses positional arguments', () => {
    const raw = ['12345', 'prod'];
    const { namedArgs, positionalArgs } = parseResolveVarsArgs(raw);
    expect(namedArgs).toEqual({});
    expect(positionalArgs).toEqual(['12345', 'prod']);
  });

  test('parses mixed arguments', () => {
    const raw = ['card_id=12345', 'positional_val'];
    const { namedArgs, positionalArgs } = parseResolveVarsArgs(raw);
    expect(namedArgs).toEqual({ card_id: '12345' });
    expect(positionalArgs).toEqual(['positional_val']);
  });
});

describe('loadVarsResolver', () => {
  test('returns null when path is null', () => {
    const fn = loadVarsResolver(null);
    expect(fn).toBeNull();
  });

  test('throws on missing file', () => {
    expect(() => loadVarsResolver('/nonexistent/vars-resolver.js')).toThrow(/Failed to load vars-resolver.js/);
  });
});

describe('executeVarsResolver', () => {
  test('normalizes null to empty object', async () => {
    const mock: VarsResolverFn = async () => null;
    const res = await executeVarsResolver(mock, { namedArgs: {}, positionalArgs: [] });
    expect(res).toEqual({});
  });

  test('throws on non-string values', async () => {
    const mock: VarsResolverFn = async () => ({ good: 'ok', bad: 123 as unknown as string });
    await expect(executeVarsResolver(mock, { namedArgs: {}, positionalArgs: [] })).rejects.toThrow(
      /non-string value for key 'bad'/,
    );
  });
});
