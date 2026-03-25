import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { saveOutput, readLatestRun } from '../../../src/context/outputStore';

describe('outputStore flattened persistence', () => {
  let cwd: string;
  let outputsDir: string;

  beforeEach(() => {
    cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'raili-output-test-'));
    outputsDir = path.join(cwd, '.raili', 'main', 'outputs');
    fs.mkdirSync(outputsDir, { recursive: true });
  });

  afterEach(() => {
    if (fs.existsSync(cwd)) fs.rmSync(cwd, { recursive: true, force: true });
  });

  test('saveOutput writes into parent workflow outputs dir when workflowArg provided', () => {
    saveOutput(cwd, 'sub_state', 'OUTPUT:\nhello world\n', { store: true, marker: 'OUTPUT:' }, 'main');

    const p = path.join(cwd, '.raili', 'main', 'outputs', 'sub_state.md');
    expect(fs.existsSync(p)).toBe(true);

    const latest = readLatestRun(cwd, 'sub_state', 'main');
    expect(latest).toContain('hello world');
  });
});
