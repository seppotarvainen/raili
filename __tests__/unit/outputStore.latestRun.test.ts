import * as fs from 'fs';
import * as path from 'path';
import { readLatestRun } from '../../src/outputStore';

describe('readLatestRun', () => {
  const cwd = path.join(__dirname, 'tmp_project');
  const outputsDir = path.join(cwd, '.raili', 'main', 'outputs');

  beforeEach(() => {
    if (fs.existsSync(cwd)) fs.rmSync(cwd, { recursive: true, force: true });
    fs.mkdirSync(outputsDir, { recursive: true });
  });

  afterEach(() => {
    if (fs.existsSync(cwd)) fs.rmSync(cwd, { recursive: true, force: true });
  });

  test('returns null when no file exists', () => {
    const res = readLatestRun(cwd, 'nonexistent');
    expect(res).toBeNull();
  });

  test('reads last run content when multiple runs present', () => {
    const p = path.join(outputsDir, 'teststate.md');
    const content = `first run\n--- Run 2026-03-01T00:00:00Z ---\nold\n\n--- Run 2026-03-02T00:00:00Z ---\nnewest content\n`;
    fs.writeFileSync(p, content, 'utf8');
    const res = readLatestRun(cwd, 'teststate');
    expect(res).toContain('newest content');
  });
});
