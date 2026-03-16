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

  beforeEach(() => {
    tmpdir = fs.mkdtempSync(path.join(os.tmpdir(), 'raili-run-'));
    jest.resetAllMocks();
    Engine.mockImplementation(() => ({ run: jest.fn().mockResolvedValue(undefined) }));
  });

  afterEach(() => {
    fs.rmSync(tmpdir, { recursive: true, force: true });
  });

  test('loads alternate workflow and runs engine (clean mode)', async () => {
    const railiDir = path.join(tmpdir, '.raili');
    fs.mkdirSync(railiDir);

    const altWorkflow = ['initial: alt', 'states:', '  alt:', "    type: engine", '  done:', '    type: engine'].join('\n');
    // Place the alternate workflow in .raili to test preference
    fs.writeFileSync(path.join(railiDir, 'workflow-dev.yaml'), altWorkflow);

    fs.writeFileSync(path.join(railiDir, 'agent-registry.json'), JSON.stringify({}));
    fs.writeFileSync(path.join(railiDir, 'script-registry.json'), JSON.stringify({}));

    registryValidator.validateAgentRegistry.mockImplementation(() => ({}));
    registryValidator.validateScriptRegistry.mockImplementation(() => ({}));
    registryValidator.validateWorkflowReferences.mockImplementation(() => {});

    const mockRun = jest.fn().mockResolvedValue(undefined);
    Engine.mockImplementation(() => ({ run: mockRun }));

    await runCommand(tmpdir, 'clean', {}, 'workflow-dev.yaml');

    expect(Engine).toHaveBeenCalledTimes(1);
    expect(mockRun).toHaveBeenCalledTimes(1);
  });

  test('continue mode preserves context.json even when using alternate workflow', async () => {
    const railiDir = path.join(tmpdir, '.raili');
    fs.mkdirSync(railiDir);

    // Create alternate workflow in cwd
    const altWorkflow = ['initial: alt', 'states:', '  alt:', "    type: engine", '  done:', '    type: engine'].join('\n');
    fs.writeFileSync(path.join(tmpdir, 'workflow-other.yaml'), altWorkflow);

    fs.writeFileSync(path.join(railiDir, 'workflow.yaml'), 'initial: init\nstates:\n  init:\n    type: engine\n  done:\n    type: engine\n');
    fs.writeFileSync(path.join(railiDir, 'agent-registry.json'), JSON.stringify({}));
    fs.writeFileSync(path.join(railiDir, 'script-registry.json'), JSON.stringify({}));

    // Write an existing context
    const existingContext = JSON.stringify({ stateHistory: [{ state: 'init', enteredAt: new Date().toISOString() }] });
    fs.writeFileSync(path.join(railiDir, 'context.json'), existingContext);

    registryValidator.validateAgentRegistry.mockImplementation(() => ({}));
    registryValidator.validateScriptRegistry.mockImplementation(() => ({}));
    registryValidator.validateWorkflowReferences.mockImplementation(() => {});

    Engine.mockImplementation(() => ({ run: jest.fn().mockResolvedValue(undefined) }));

    await runCommand(tmpdir, 'continue', {}, 'workflow-other.yaml');

    expect(fs.existsSync(path.join(railiDir, 'context.json'))).toBe(true);
    expect(fs.readFileSync(path.join(railiDir, 'context.json'), 'utf8')).toBe(existingContext);
  });
});
