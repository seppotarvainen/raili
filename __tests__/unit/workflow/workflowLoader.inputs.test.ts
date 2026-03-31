import path from 'path';
import { setupFakeFs } from '../infrastructure/fsFake.util';
import { getFileSystem } from '../../../src/infrastructure/fileSystemProvider';
import { loadWorkflowConfig } from '../../../src/workflow/workflowLoader';

const TMP = '/tmp';
let restoreFs: () => void;

beforeEach(() => {
  restoreFs = setupFakeFs();
});

afterEach(() => {
  restoreFs();
});

test('duplicate input key in parent and sub-workflow -> validation error', () => {
  const p = path.join(TMP, '.raili', 'main');
  getFileSystem().mkdirSync(p, { recursive: true } as any);

  const main = [
    'initial: start',
    'inputs:',
    '  - ticket_id',
    'states:',
    '  start:',
    "    type: group",
    "    group: sub_workflow.yaml",
  ].join('\n');

  getFileSystem().writeFileSync(path.join(p, 'workflow.yaml'), main);

  const sub = [
    'states:',
    '  analyze:',
    '    type: engine',
    'inputs:',
    '  - ticket_id',
  ].join('\n');

  getFileSystem().writeFileSync(path.join(p, 'sub_workflow.yaml'), sub);

  expect(() => loadWorkflowConfig(TMP)).toThrow(/Duplicate input key 'ticket_id'/);
});
