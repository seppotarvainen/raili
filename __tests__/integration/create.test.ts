import { createTmpWorkspace, cleanupTmpWorkspace } from './testUtils';
import { createCommand } from '../../src/cli/create';
import { loadWorkflowConfig } from '../../src/workflow/workflowLoader';

describe('createCommand integration', () => {
  let tmp: string;
  beforeEach(() => {
    tmp = createTmpWorkspace();
  });
  afterEach(() => {
    cleanupTmpWorkspace(tmp);
  });

  test('creates a named workflow and it is loadable', async () => {
    await createCommand(tmp, 'feature');
    const cfg = loadWorkflowConfig(tmp, 'feature');
    expect(cfg).toBeDefined();
    expect(cfg.states).toBeDefined();
  });
});
