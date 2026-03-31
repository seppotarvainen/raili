import path from 'path';
import { setupFakeFs } from './infrastructure/fsFake.util';
import { getFileSystem } from '../../src/infrastructure/fileSystemProvider';
import { runCommand } from '../../src/run';

// Hoisted mocks — must come before any require() calls
jest.mock('../../src/workflow/workflowLoader', () => {
  const actual = jest.requireActual('../../src/workflow/workflowLoader');
  return {
    loadWorkflowConfig: jest.fn().mockReturnValue({
      initial: 'start',
      states: {
        start: { type: 'engine', skip: 'done' },
        done: { type: 'engine' },
      },
    }),
    buildStateMachine: actual.buildStateMachine,
    validateStateMachine: actual.validateStateMachine,
  };
});

jest.mock('../../src/registry/registryValidator');
jest.mock('../../src/runner/runner');

const { Runner } = require('../../src/runner/runner');

describe('runCommand skip confirmation', () => {
  let tmp: string;
  let restoreFs: () => void;

  beforeEach(() => {
    restoreFs = setupFakeFs();
    tmp = path.join('/tmp', `raili-test-${Math.random().toString(36).slice(2, 8)}`);
    const fs = getFileSystem();
    fs.mkdirSync(path.join(tmp, '.raili'), { recursive: true });
    fs.mkdirSync(path.join(tmp, '.raili', 'main'), { recursive: true });
    fs.writeFileSync(path.join(tmp, '.raili', 'agent-registry.json'), '{}');
    fs.writeFileSync(path.join(tmp, '.raili', 'script-registry.json'), '{}');
    jest.clearAllMocks();
    Runner.mockImplementation(() => ({ run: jest.fn().mockResolvedValue(undefined) }));
  });

  afterEach(() => {
    restoreFs();
    delete process.env.RAILI_MANUAL_CHOICE;
  });

  test('aborts run when user declines skip via RAILI_MANUAL_CHOICE', async () => {
    process.env.RAILI_MANUAL_CHOICE = 'FAILED';
    const exitSpy = jest.spyOn(process, 'exit').mockImplementation((() => {}) as any);

    await runCommand(tmp, 'clean', {}, undefined);

    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(Runner).not.toHaveBeenCalled();

    exitSpy.mockRestore();
  });

  test('continues run when user accepts skip via RAILI_MANUAL_CHOICE', async () => {
    process.env.RAILI_MANUAL_CHOICE = 'PASSED';

    await runCommand(tmp, 'clean', {}, undefined);

    expect(Runner).toHaveBeenCalled();
  });
});
