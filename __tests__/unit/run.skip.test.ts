import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

// Use isolateModules and manual mocks to ensure module imports occur after mocks are applied
describe('runCommand skip confirmation', () => {
  let tmp: string;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'raili-test-'));
    fs.mkdirSync(path.join(tmp, '.raili'));
    fs.mkdirSync(path.join(tmp, '.raili', 'main'));
    fs.writeFileSync(path.join(tmp, '.raili', 'agent-registry.json'), '{}');
    fs.writeFileSync(path.join(tmp, '.raili', 'script-registry.json'), '{}');
  });

  afterEach(() => {
    try {
      fs.rmSync(tmp, { recursive: true, force: true });
    } catch (err) {
      // ignore
    }
    delete process.env.RAILI_MANUAL_CHOICE;
  });

  test('aborts run when user declines skip via RAILI_MANUAL_CHOICE', async () => {
    // Arrange: mock workflowLoader to return a simple workflow with skip
    jest.resetModules();
    process.env.RAILI_MANUAL_CHOICE = 'FAILED';

    jest.doMock('../../src/workflow/workflowLoader', () => {
      const actual = jest.requireActual('../../src/workflow/workflowLoader');
      return {
        loadWorkflowConfig: () => ({
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

    const exitSpy = jest.spyOn(process, 'exit').mockImplementation(((code?: number) => {
      // noop
    }) as any);

    const { runCommand } = require('../../src/run');
    const { Runner } = require('../../src/runner/runner');
    const runSpy = jest.spyOn(Runner.prototype, 'run').mockImplementation(async () => {});

    // Act
    await runCommand(tmp, 'clean', {}, undefined);

    // Assert
    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(runSpy).not.toHaveBeenCalled();

    // Cleanup
    exitSpy.mockRestore();
    runSpy.mockRestore();
  });

  test('continues run when user accepts skip via RAILI_MANUAL_CHOICE', async () => {
    jest.resetModules();
    process.env.RAILI_MANUAL_CHOICE = 'PASSED';

    jest.doMock('../../src/workflow/workflowLoader', () => {
      const actual = jest.requireActual('../../src/workflow/workflowLoader');
      return {
        loadWorkflowConfig: () => ({
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

    const { runCommand } = require('../../src/run');
    const { Runner } = require('../../src/runner/runner');
    const runSpy = jest.spyOn(Runner.prototype, 'run').mockImplementation(async () => {});

    await runCommand(tmp, 'clean', {}, undefined);

    expect(runSpy).toHaveBeenCalled();

    runSpy.mockRestore();
  });
});
