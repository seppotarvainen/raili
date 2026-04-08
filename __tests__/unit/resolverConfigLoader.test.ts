import { setupFakeFs } from './infrastructure/fsFake.util';
import { getResolverConfigDefaults, loadResolverConfig } from '../../src/resolverConfigLoader';

describe('resolverConfigLoader', () => {
  let restore: () => void;

  beforeEach(() => {
    restore = setupFakeFs();
  });

  afterEach(() => {
    restore();
  });

  test('returns defaults when configPath is null', () => {
    const defaults = getResolverConfigDefaults();
    const loaded = loadResolverConfig(null);
    expect(loaded).toEqual(defaults);
  });

  test('loads and merges valid config', () => {
    const path = '/tmp/resolver-config.json';
    const content = JSON.stringify({ trigger: { interval: 30 }, approval: { timeout: 10 } });
    // write file
    const fs = require('../../src/infrastructure/fileSystemProvider').getFileSystem();
    fs.writeFileSync(path, content, 'utf8');

    const loaded = loadResolverConfig(path);
    expect(loaded.trigger?.interval).toBe(30);
    // other trigger defaults remain
    expect(loaded.trigger?.retry_interval).toBe(5);
    // approval overridden
    expect(loaded.approval?.timeout).toBe(10);
    // feedback default
    expect(loaded.feedback?.timeout).toBe(3600);
  });

  test('throws on malformed JSON', () => {
    const path = '/tmp/bad.json';
    const content = '{ not: valid json }';
    const fs = require('../../src/infrastructure/fileSystemProvider').getFileSystem();
    fs.writeFileSync(path, content, 'utf8');
    expect(() => loadResolverConfig(path)).toThrow(/Malformed JSON/);
  });

  test('throws on invalid types', () => {
    const path = '/tmp/invalid.json';
    const content = JSON.stringify({ trigger: { interval: 'fast' } });
    const fs = require('../../src/infrastructure/fileSystemProvider').getFileSystem();
    fs.writeFileSync(path, content, 'utf8');
    expect(() => loadResolverConfig(path)).toThrow(
      /resolverConfig.trigger.interval must be a number/,
    );
  });
});
