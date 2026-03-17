import { runCommand } from '../../src/run';
import { loadWorkflowConfig } from '../../src/workflowLoader';
import * as fs from 'fs';
import { validateAgentRegistry, validateScriptRegistry, validateWorkflowReferences } from '../../src/registryValidator';
import { loadContext } from '../../src/context';
import { Engine } from '../../src/engine/Engine';

jest.mock('../../src/workflowLoader');
jest.mock('fs');
jest.mock('../../src/registryValidator');
jest.mock('../../src/context');
jest.mock('../../src/engine/Engine');

describe('run (integration - alternate workflow)', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    (fs.existsSync as jest.Mock).mockImplementation((p: string) => true);
    (fs.statSync as jest.Mock).mockImplementation(() => ({ isDirectory: () => true }));
    (loadWorkflowConfig as jest.Mock).mockReturnValue({ initial: 'start', states: {} });
    (validateAgentRegistry as jest.Mock).mockReturnValue({});
    (validateScriptRegistry as jest.Mock).mockReturnValue({});
    (validateWorkflowReferences as jest.Mock).mockReturnValue(undefined);
    (loadContext as jest.Mock).mockReturnValue({ stateHistory: [] });
    (Engine as unknown as jest.Mock).mockImplementation(() => ({ run: jest.fn().mockResolvedValue(undefined) }));
  });

  test('runs with alternate workflow and respects workflowPath', async () => {
    await runCommand('/cwd', 'clean', {}, 'workflow-dev.yaml');
    expect(loadWorkflowConfig).toHaveBeenCalledWith('/cwd', 'workflow-dev.yaml');
  });
});
