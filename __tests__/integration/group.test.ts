import path from 'path';
import fs from 'fs';
import { createTmpWorkspace, cleanupTmpWorkspace, writeNamedWorkflow, writeWorkflow } from './testUtils';
import { loadWorkflowConfig } from '../../src/workflow/workflowLoader';
import { validateWorkflowNesting } from '../../src/registry/registryValidator';

let tmp: string;

beforeEach(() => {
  tmp = createTmpWorkspace();
});

afterEach(() => {
  cleanupTmpWorkspace(tmp);
});

test('valid group workflow passes validation', () => {
  writeNamedWorkflow(tmp, 'subflows', ['states:', '  done:', "    type: engine", "    out: true", ''].join('\n'));
  const mainYaml = ['initial: start', 'states:', '  start:', '    type: engine', '    transitions:', '      proceed: do_group', "  do_group:\n    type: group\n    group: ./subflows/workflow.yaml\n    on:\n      PASSED: finish", '  finish:', '    type: engine', ''].join('\n');
  // writeWorkflow helper writes to .raili/main/workflow.yaml
  writeWorkflow(tmp, mainYaml);

  const cfg = loadWorkflowConfig(tmp);
  expect(() => validateWorkflowNesting(cfg, path.join(tmp, '.raili', 'main'))).not.toThrow();
});

test('missing sub-workflow file fails validation', () => {
  const mainYaml = ['initial: start', 'states:', '  start:', '    type: engine', '  do_group:', "    type: group\n    group: ./subflows/missing.yaml", ''].join('\n');
  writeWorkflow(tmp, mainYaml);
  const cfg = loadWorkflowConfig(tmp);
  expect(() => validateWorkflowNesting(cfg, path.join(tmp, '.raili', 'main'))).toThrow(/references missing sub-workflow/);
});
