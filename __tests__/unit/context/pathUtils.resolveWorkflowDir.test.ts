import { setupFakeFs } from '../infrastructure/fsFake.util';
import { getFileSystem } from '../../../src/infrastructure/fileSystemProvider';
import { resolveWorkflowDir, resolveResolverConfigPath } from '../../../src/context/pathUtils';

describe('resolveWorkflowDir and resolver config path', () => {
  let restore: () => void;
  beforeEach(() => {
    restore = setupFakeFs();
  });
  afterEach(() => restore());

  test('resolveWorkflowDir finds .raili/main when present', () => {
    const fs = getFileSystem();
    fs.mkdirSync('/project', { recursive: true } as any);
    fs.mkdirSync('/project/.raili', { recursive: true } as any);
    fs.mkdirSync('/project/.raili/main', { recursive: true } as any);

    expect(resolveWorkflowDir('/project')).toBe('/project/.raili/main');
  });

  test('resolveWorkflowDir finds named workflow', () => {
    const fs = getFileSystem();
    fs.mkdirSync('/repo', { recursive: true } as any);
    fs.mkdirSync('/repo/.raili', { recursive: true } as any);
    fs.mkdirSync('/repo/.raili/feature', { recursive: true } as any);

    expect(resolveWorkflowDir('/repo', 'feature')).toBe('/repo/.raili/feature');
  });

  test('resolveWorkflowDir throws when missing', () => {
    expect(() => resolveWorkflowDir('/nope')).toThrow(/Unable to resolve workflow directory/);
  });

  test('resolveResolverConfigPath returns config path when exists', () => {
    const fs = getFileSystem();
    fs.mkdirSync('/work', { recursive: true } as any);
    fs.mkdirSync('/work/.raili', { recursive: true } as any);
    fs.mkdirSync('/work/.raili/main', { recursive: true } as any);

    const cfg = '/work/.raili/main/config.json';
    fs.writeFileSync(cfg, JSON.stringify({}), 'utf8');

    expect(resolveResolverConfigPath('/work/.raili/main')).toBe(cfg);

    // remove it
    fs.rmSync(cfg);
    expect(resolveResolverConfigPath('/work/.raili/main')).toBeNull();
  });
});
