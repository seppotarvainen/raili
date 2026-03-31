import * as path from 'path';
import { setupFakeFs } from '../infrastructure/fsFake.util';
import { getFileSystem } from '../../../src/infrastructure/fileSystemProvider';
import { outputPath, saveOutput, readLatestRun, loadAgentOutputPath } from '../../../src/context/outputStore';

describe('outputStore filename rules', () => {
  it('outputPath strips parent prefix for group.sub ids', () => {
    const restoreFs = setupFakeFs();
    const cwd = '/tmp/test-workspace';
    const workflow = 'main';
    const outputsDir = path.join(cwd, '.raili', workflow, 'outputs');
    getFileSystem().mkdirSync(outputsDir, { recursive: true } as any);

    const p1 = outputPath(cwd, 'group.sub', workflow);
    expect(path.basename(p1)).toBe('sub.md');

    const p2 = outputPath(cwd, 'plain', workflow);
    expect(path.basename(p2)).toBe('plain.md');

    // cleanup
    restoreFs();
  });

  it('saveOutput/readLatestRun/loadAgentOutputPath use canonical filename', () => {
    const restoreFs = setupFakeFs();
    const cwd = '/tmp/test-workspace';
    const workflow = 'main';
    const outputsDir = path.join(cwd, '.raili', workflow, 'outputs');
    getFileSystem().mkdirSync(outputsDir, { recursive: true } as any);

    saveOutput(cwd, 'group.produce', 'OUTPUT:\nhello world\n', { store: true, marker: 'OUTPUT:' }, workflow);

    const p = loadAgentOutputPath(cwd, 'group.produce', workflow);
    expect(p).not.toBeNull();
    expect(path.basename(p as string)).toBe('produce.md');

    const latest = readLatestRun(cwd, 'group.produce', workflow);
    expect(latest).toContain('hello world');

    // cleanup
    restoreFs();
  });
});
