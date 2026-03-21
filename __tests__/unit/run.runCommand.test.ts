import {runCommand} from '../../src/run';
import {loadWorkflowConfig} from '../../src/workflow/workflowLoader';
import * as fs from 'fs';
import {
  validateAgentRegistry,
  validateScriptRegistry,
  validateWorkflowReferences
} from '../../src/registry/registryValidator';
import {clearContext, initializeContext, loadContext} from '../../src/context/context';
import {Runner} from '../../src/runner/Runner';

jest.mock('../../src/workflow/workflowLoader');
jest.mock('fs');
jest.mock('../../src/registry/registryValidator');
jest.mock('../../src/context/context');
jest.mock('../../src/runner/Runner');

describe('runCommand', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    (fs.existsSync as jest.Mock).mockImplementation((p: string) => true);
    (fs.statSync as jest.Mock).mockImplementation(() => ({ isDirectory: () => true }));
    (loadWorkflowConfig as jest.Mock).mockReturnValue({ initial: 'start', states: {} });
    (validateAgentRegistry as jest.Mock).mockReturnValue({});
    (validateScriptRegistry as jest.Mock).mockReturnValue({});
    (validateWorkflowReferences as jest.Mock).mockReturnValue(undefined);
    (loadContext as jest.Mock).mockReturnValue({ stateHistory: [], vars: {} });
    (initializeContext as jest.Mock).mockReturnValue({ stateHistory: [], vars: {} });
    (clearContext as jest.Mock).mockReturnValue(undefined);
    (Runner as unknown as jest.Mock).mockImplementation(() => ({ run: jest.fn().mockResolvedValue(undefined) }));
  });

  test('passes workflowPath to loadWorkflowConfig', async () => {
    await runCommand('/cwd', 'clean', {}, 'workflow-dev.yaml');
    expect(loadWorkflowConfig).toHaveBeenCalledWith('/cwd', 'workflow-dev.yaml');
  });

  test('loads workflow vars file in clean mode and merges with supplied vars (flags override file)', async () => {
    // Arrange: workflow declares two inputs
    (loadWorkflowConfig as jest.Mock).mockReturnValue({ initial: 'start', states: {}, inputs: ['ticket_id', 'secret'] });

    // Mock fs to indicate vars file exists and contains YAML
    (fs.existsSync as jest.Mock).mockImplementation((p: string) => true);
    (fs.readFileSync as unknown as jest.Mock).mockImplementation((p: string) => 'ticket_id: T1\nsecret: X\n');

    // Act: call runCommand with a flag overriding ticket_id
    await runCommand('/cwd', 'clean', { ticket_id: 'OVERRIDE' }, 'main');

    // Assert: initializeContext should be called with merged vars: file + flags (flags win)
    expect(initializeContext).toHaveBeenCalled();
    const calledWith = (initializeContext as jest.Mock).mock.calls[0][0];
    expect(calledWith).toEqual({ ticket_id: 'OVERRIDE', secret: 'X' });
  });
});
