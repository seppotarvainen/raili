import fs from 'fs';
import path from 'path';
import os from 'os';
import { runCommand } from '../../src/run';

jest.mock('../../src/registryValidator');
jest.mock('../../src/engine/Engine');

const registryValidator = require('../../src/registryValidator');
const { Engine } = require('../../src/engine/Engine');

describe('runCommand with workflow path', () => {
  let tmpdir: string;
  let railiDir: string;

  beforeEach(() => {
    tmpdir = fs.mkdtempSync(path.join(os.tmpdir(), 'raili-run-'));
    railiDir = path.join(tmpdir, '.raili');
    jest.resetAllMocks();
    Engine.mockImplementation(() => ({ run: jest.fn().mockResolvedValue(undefined) }));
  });

  afterEach(() => {
    fs.rmSync(tmpdir, { recursive: true, force: true });
  });

  test('loads named workflow and runs engine (clean mode)', async () => {
    const devDir = path.join(railiDir, 'dev');
    fs.mkdirSync(devDir, { recursive: true });

    const altWorkflow = ['initial: alt', 'states:', '  alt:', "    type: engine", '  done:', '    type: engine'].join('\n');
    fs.writeFileSync(path.join(devDir, 'workflow.yaml'), altWorkflow);
    fs.writeFileSync(path.join(railiDir, 'agent-registry.json'), JSON.stringify({}));
    fs.writeFileSync(path.join(railiDir, 'script-registry.json'), JSON.stringify({}));

    registryValidator.validateAgentRegistry.mockImplementation(() => ({}));
    registryValidator.validateScriptRegistry.mockImplementation(() => ({}));
    registryValidator.validateWorkflowReferences.mockImplementation(() => {});

    const mockRun = jest.fn().mockResolvedValue(undefined);
    Engine.mockImplementation(() => ({ run: mockRun }));

    await runCommand(tmpdir, 'clean', {}, 'dev');

    expect(Engine).toHaveBeenCalledTimes(1);
    expect(mockRun).toHaveBeenCalledTimes(1);
  });

  test('continue mode preserves context.json for named workflow', async () => {
    const devDir = path.join(railiDir, 'dev');
    fs.mkdirSync(devDir, { recursive: true });

    const altWorkflow = ['initial: alt', 'states:', '  alt:', "    type: engine", '  done:', '    type: engine'].join('\n');
    fs.writeFileSync(path.join(devDir, 'workflow.yaml'), altWorkflow);

    const existingContext = JSON.stringify({ stateHistory: [{ state: 'alt', enteredAt: new Date().toISOString() }] });
    fs.writeFileSync(path.join(devDir, 'context.json'), existingContext);

    fs.writeFileSync(path.join(railiDir, 'agent-registry.json'), JSON.stringify({}));
    fs.writeFileSync(path.join(railiDir, 'script-registry.json'), JSON.stringify({}));

    registryValidator.validateAgentRegistry.mockImplementation(() => ({}));
    registryValidator.validateScriptRegistry.mockImplementation(() => ({}));
    registryValidator.validateWorkflowReferences.mockImplementation(() => {});
    Engine.mockImplementation(() => ({ run: jest.fn().mockResolvedValue(undefined) }));

    await runCommand(tmpdir, 'continue', {}, 'dev');

    expect(fs.existsSync(path.join(devDir, 'context.json'))).toBe(true);
    expect(fs.readFileSync(path.join(devDir, 'context.json'), 'utf8')).toBe(existingContext);
  });
});
