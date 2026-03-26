import fs from 'fs';
import path from 'path';
import os from 'os';
import {loadWorkflowConfig} from '../../../src/workflow/workflowLoader';

describe('workflowLoader inputs merging', () => {
  let tmpdir: string;

  beforeEach(() => {
    tmpdir = fs.mkdtempSync(path.join(os.tmpdir(), 'raili-wf-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpdir, { recursive: true, force: true });
  });

  test('duplicate input key in parent and sub-workflow -> validation error', () => {
    const p = path.join(tmpdir, '.raili', 'main');
    fs.mkdirSync(p, { recursive: true });

    const main = [
      'initial: start',
      'inputs:',
      '  - ticket_id',
      'states:',
      '  start:',
      "    type: group",
      "    group: sub_workflow.yaml",
    ].join('\n');

    fs.writeFileSync(path.join(p, 'workflow.yaml'), main);

    const sub = [
      'states:',
      '  analyze:',
      '    type: engine',
      'inputs:',
      '  - ticket_id',
    ].join('\n');

    fs.writeFileSync(path.join(p, 'sub_workflow.yaml'), sub);

    expect(() => loadWorkflowConfig(tmpdir)).toThrow(/Duplicate input key 'ticket_id'/);
  });
});
