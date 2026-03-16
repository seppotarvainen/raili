import fs from 'fs';
import path from 'path';
import os from 'os';
import { loadWorkflowConfig } from '../../src/workflowLoader';

describe('loadWorkflowConfig with workflow path', () => {
  let tmpdir: string;

  beforeEach(() => {
    tmpdir = fs.mkdtempSync(path.join(os.tmpdir(), 'raili-wf-'));
  });

  afterEach(() => {
    fs.rmSync(tmpdir, { recursive: true, force: true });
  });

  test('prefers .raili/<name> when present', () => {
    const railiDir = path.join(tmpdir, '.raili');
    fs.mkdirSync(railiDir);
    const workflow = ['initial: init', 'states:', '  init:', "    type: engine", '  done:', '    type: engine'].join('\n');
    fs.writeFileSync(path.join(railiDir, 'workflow-dev.yaml'), workflow);

    const config = loadWorkflowConfig(tmpdir, 'workflow-dev.yaml');
    expect(config.initial).toBe('init');
  });

  test('loads cwd/<name> when .raili/<name> missing', () => {
    const railiDir = path.join(tmpdir, '.raili');
    fs.mkdirSync(railiDir);
    const workflow = ['initial: start', 'states:', '  start:', "    type: engine", '  done:', '    type: engine'].join('\n');
    fs.writeFileSync(path.join(tmpdir, 'workflow-dev.yaml'), workflow);

    const config = loadWorkflowConfig(tmpdir, 'workflow-dev.yaml');
    expect(config.initial).toBe('start');
  });

  test('throws when referenced workflow file does not exist', () => {
    const railiDir = path.join(tmpdir, '.raili');
    fs.mkdirSync(railiDir);

    expect(() => loadWorkflowConfig(tmpdir, 'nonexistent.yaml')).toThrow('Workflow file not found');
  });
});
