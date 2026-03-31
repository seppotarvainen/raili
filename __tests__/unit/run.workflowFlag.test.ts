import path from 'path';
import os from 'os';
import { runCommand } from '../../src/run';
import { setupFakeFs } from './infrastructure/fsFake.util';
import { getFileSystem } from '../../src/infrastructure/fileSystemProvider';

let fs: any;

jest.mock('../../src/registry/registryValidator');
jest.mock('../../src/runner/runner');

const registryValidator = require('../../src/registry/registryValidator');
const { Runner } = require('../../src/runner/runner');

describe('runCommand with workflow path', () => {
  let tmpdir: string;
  let railiDir: string;

  beforeEach(() => {
    const restoreFs = setupFakeFs();
    (global as any).__restoreFs = restoreFs;
    tmpdir = path.join('/tmp', `raili-run-${Math.random().toString(36).slice(2, 8)}`);
    railiDir = path.join(tmpdir, '.raili');
    fs = getFileSystem();
    jest.resetAllMocks();
    Runner.mockImplementation(() => ({ run: jest.fn().mockResolvedValue(undefined) }));
  });

  afterEach(() => {
    const restore = (global as any).__restoreFs;
    if (restore) restore();
  });

  test('loads named workflow and runs engine (clean mode)', async () => {
    const devDir = path.join(railiDir, 'dev');
    fs.mkdirSync(devDir, { recursive: true });

    const altWorkflow = [
      'initial: alt',
      'states:',
      '  alt:',
      '    type: engine',
      '  done:',
      '    type: engine',
    ].join('\n');
    fs.writeFileSync(path.join(devDir, 'workflow.yaml'), altWorkflow);
    fs.writeFileSync(path.join(railiDir, 'agent-registry.json'), JSON.stringify({}));
    fs.writeFileSync(path.join(railiDir, 'script-registry.json'), JSON.stringify({}));

    registryValidator.validateAgentRegistry.mockImplementation(() => ({}));
    registryValidator.validateScriptRegistry.mockImplementation(() => ({}));
    registryValidator.validateWorkflowReferences.mockImplementation(() => {});

    const mockRun = jest.fn().mockResolvedValue(undefined);
    Runner.mockImplementation(() => ({ run: mockRun }));

    await runCommand(tmpdir, 'clean', {}, 'dev');

    expect(Runner).toHaveBeenCalledTimes(1);
    expect(mockRun).toHaveBeenCalledTimes(1);
  });

  test('continue mode preserves context.json for named workflow', async () => {
    const devDir = path.join(railiDir, 'dev');
    fs.mkdirSync(devDir, { recursive: true });

    const altWorkflow = [
      'initial: alt',
      'states:',
      '  alt:',
      '    type: engine',
      '  done:',
      '    type: engine',
    ].join('\n');
    fs.writeFileSync(path.join(devDir, 'workflow.yaml'), altWorkflow);

    const existingContext = JSON.stringify({
      stateHistory: [{ state: 'alt', enteredAt: new Date().toISOString() }],
    });
    fs.writeFileSync(path.join(devDir, 'context.json'), existingContext);

    fs.writeFileSync(path.join(railiDir, 'agent-registry.json'), JSON.stringify({}));
    fs.writeFileSync(path.join(railiDir, 'script-registry.json'), JSON.stringify({}));

    registryValidator.validateAgentRegistry.mockImplementation(() => ({}));
    registryValidator.validateScriptRegistry.mockImplementation(() => ({}));
    registryValidator.validateWorkflowReferences.mockImplementation(() => {});
    Runner.mockImplementation(() => ({ run: jest.fn().mockResolvedValue(undefined) }));

    await runCommand(tmpdir, 'continue', {}, 'dev');

    expect(fs.existsSync(path.join(devDir, 'context.json'))).toBe(true);
    expect(fs.readFileSync(path.join(devDir, 'context.json'), 'utf8')).toBe(existingContext);
  });
});
