import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { outputPath, saveOutput, readLatestRun, loadAgentOutputPath } from '../../../src/context/outputStore';

describe('outputStore filename rules', () => {
  it('outputPath strips parent prefix for group.sub ids', () => {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'raili-op-'));
    const workflow = 'main';
    const outputsDir = path.join(cwd, '.raili', workflow, 'outputs');
    fs.mkdirSync(outputsDir, { recursive: true });

    const p1 = outputPath(cwd, 'group.sub', workflow);
    expect(path.basename(p1)).toBe('sub.md');

    const p2 = outputPath(cwd, 'plain', workflow);
    expect(path.basename(p2)).toBe('plain.md');

    // cleanup
    if (fs.existsSync(cwd)) fs.rmSync(cwd, { recursive: true, force: true });
  });

  it('saveOutput/readLatestRun/loadAgentOutputPath use canonical filename', () => {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'raili-op-'));
    const workflow = 'main';
    const outputsDir = path.join(cwd, '.raili', workflow, 'outputs');
    fs.mkdirSync(outputsDir, { recursive: true });

    saveOutput(cwd, 'group.produce', 'OUTPUT:\nhello world\n', { store: true, marker: 'OUTPUT:' }, workflow);

    const p = loadAgentOutputPath(cwd, 'group.produce', workflow);
    expect(p).not.toBeNull();
    expect(path.basename(p as string)).toBe('produce.md');

    const latest = readLatestRun(cwd, 'group.produce', workflow);
    expect(latest).toContain('hello world');

    // cleanup
    if (fs.existsSync(cwd)) fs.rmSync(cwd, { recursive: true, force: true });
  });
});
