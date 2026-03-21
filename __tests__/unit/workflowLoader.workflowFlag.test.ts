import fs from 'fs';
import path from 'path';
import os from 'os';
import {loadWorkflowConfig} from '../../src/workflow/workflowLoader';

describe('loadWorkflowConfig with workflow path', () => {
  let tmpdir: string;

  beforeEach(() => {
    tmpdir = fs.mkdtempSync(path.join(os.tmpdir(), 'raili-wf-'));
  });

  afterEach(() => {
    fs.rmSync(tmpdir, { recursive: true, force: true });
  });

  test('loads workflow from .raili/<name>/ directory', () => {
    const devDir = path.join(tmpdir, '.raili', 'dev');
    fs.mkdirSync(devDir, { recursive: true });
    const workflow = ['initial: init', 'states:', '  init:', "    type: engine", '  done:', '    type: engine'].join('\n');
    fs.writeFileSync(path.join(devDir, 'workflow.yaml'), workflow);

    const config = loadWorkflowConfig(tmpdir, 'dev');
    expect(config.initial).toBe('init');
  });

  test('throws when named workflow directory does not exist', () => {
    const railiDir = path.join(tmpdir, '.raili');
    fs.mkdirSync(railiDir);

    expect(() => loadWorkflowConfig(tmpdir, 'nonexistent')).toThrow(
      'Unable to resolve workflow directory',
    );
  });

  test('throws when workflow.yaml missing in named directory', () => {
    const devDir = path.join(tmpdir, '.raili', 'dev');
    fs.mkdirSync(devDir, { recursive: true });

    expect(() => loadWorkflowConfig(tmpdir, 'dev')).toThrow('Workflow file not found');
  });
});
