import fs from 'fs';
import path from 'path';
import os from 'os';
import { runCommand } from '../../src/run';

jest.mock('../../src/registry/registryValidator');
jest.mock('../../src/runner/runner');

const registryValidator = require('../../src/registry/registryValidator');
const { Runner } = require('../../src/runner/runner');

describe('runCommand', () => {
  let tmpdir: string;
  let railiDir: string;
  let mainDir: string;

  beforeEach(() => {
    tmpdir = fs.mkdtempSync(path.join(os.tmpdir(), 'raili-test-'));
    railiDir = path.join(tmpdir, '.raili');
    mainDir = path.join(railiDir, 'main');
    jest.resetAllMocks();
    Runner.mockImplementation(() => ({ run: jest.fn().mockResolvedValue(undefined) }));
  });
  afterEach(() => {
    fs.rmSync(tmpdir, { recursive: true, force: true });
  });

  test('fails if .raili missing', async () => {
    await expect(runCommand(tmpdir)).rejects.toThrow('.raili/ directory not found');
  });

  test('fails if registries missing or invalid', async () => {
    fs.mkdirSync(mainDir, { recursive: true });
    const minimalWorkflow =
      'initial: init\nstates:\n  init:\n    type: engine\n  done:\n    type: engine\n';
    fs.writeFileSync(path.join(mainDir, 'workflow.yaml'), minimalWorkflow);

    await expect(runCommand(tmpdir)).rejects.toThrow('agent-registry.json not found');

    registryValidator.validateAgentRegistry.mockImplementation(() => {
      throw new Error('Agent registry JSON parse error');
    });
    registryValidator.validateScriptRegistry.mockImplementation(() => {
      throw new Error('Script registry JSON parse error');
    });

    fs.writeFileSync(path.join(railiDir, 'agent-registry.json'), 'not json');
    fs.writeFileSync(path.join(railiDir, 'script-registry.json'), 'not json');
    await expect(runCommand(tmpdir)).rejects.toThrow('Agent registry JSON parse error');
  });

  test('constructs Engine and calls run() when valid', async () => {
    fs.mkdirSync(mainDir, { recursive: true });
    const minimalWorkflow =
      'initial: init\nstates:\n  init:\n    type: engine\n  done:\n    type: engine\n';
    fs.writeFileSync(path.join(mainDir, 'workflow.yaml'), minimalWorkflow);
    fs.writeFileSync(
      path.join(railiDir, 'agent-registry.json'),
      JSON.stringify({ a: { path: './x' } }),
    );
    fs.writeFileSync(
      path.join(railiDir, 'script-registry.json'),
      JSON.stringify({ s: { path: './y' } }),
    );

    registryValidator.validateAgentRegistry.mockImplementation(() => ({ a: { path: './x' } }));
    registryValidator.validateScriptRegistry.mockImplementation(() => ({ s: { path: './y' } }));
    registryValidator.validateWorkflowReferences.mockImplementation(() => {});

    const mockRun = jest.fn().mockResolvedValue(undefined);
    Runner.mockImplementation(() => ({ run: mockRun }));

    await runCommand(tmpdir);

    expect(Runner).toHaveBeenCalledTimes(1);
    expect(mockRun).toHaveBeenCalledTimes(1);
  });

  test('clean mode deletes context.json before running', async () => {
    fs.mkdirSync(mainDir, { recursive: true });
    const minimalWorkflow =
      'initial: init\nstates:\n  init:\n    type: engine\n  done:\n    type: engine\n';
    fs.writeFileSync(path.join(mainDir, 'workflow.yaml'), minimalWorkflow);
    fs.writeFileSync(path.join(railiDir, 'agent-registry.json'), JSON.stringify({}));
    fs.writeFileSync(path.join(railiDir, 'script-registry.json'), JSON.stringify({}));

    const existingContext = JSON.stringify({
      stateHistory: [{ state: 'init', enteredAt: new Date().toISOString() }],
    });
    fs.writeFileSync(path.join(mainDir, 'context.json'), existingContext);

    registryValidator.validateAgentRegistry.mockImplementation(() => ({}));
    registryValidator.validateScriptRegistry.mockImplementation(() => ({}));
    registryValidator.validateWorkflowReferences.mockImplementation(() => {});
    Runner.mockImplementation(() => ({ run: jest.fn().mockResolvedValue(undefined) }));

    await runCommand(tmpdir, 'clean');

    expect(fs.existsSync(path.join(mainDir, 'context.json'))).toBe(false);
  });

  test('continue mode preserves existing context.json', async () => {
    fs.mkdirSync(mainDir, { recursive: true });
    const minimalWorkflow =
      'initial: init\nstates:\n  init:\n    type: engine\n  done:\n    type: engine\n';
    fs.writeFileSync(path.join(mainDir, 'workflow.yaml'), minimalWorkflow);
    fs.writeFileSync(path.join(railiDir, 'agent-registry.json'), JSON.stringify({}));
    fs.writeFileSync(path.join(railiDir, 'script-registry.json'), JSON.stringify({}));

    const existingContext = JSON.stringify({
      stateHistory: [{ state: 'init', enteredAt: new Date().toISOString() }],
    });
    fs.writeFileSync(path.join(mainDir, 'context.json'), existingContext);

    registryValidator.validateAgentRegistry.mockImplementation(() => ({}));
    registryValidator.validateScriptRegistry.mockImplementation(() => ({}));
    registryValidator.validateWorkflowReferences.mockImplementation(() => {});
    Runner.mockImplementation(() => ({ run: jest.fn().mockResolvedValue(undefined) }));

    await runCommand(tmpdir, 'continue');

    expect(fs.existsSync(path.join(mainDir, 'context.json'))).toBe(true);
    expect(fs.readFileSync(path.join(mainDir, 'context.json'), 'utf8')).toBe(existingContext);
  });

  test('vars are set on process.env as RAILI_VAR_* and stored in context', async () => {
    fs.mkdirSync(mainDir, { recursive: true });
    const minimalWorkflow =
      'initial: init\nstates:\n  init:\n    type: engine\n  done:\n    type: engine\n';
    fs.writeFileSync(path.join(mainDir, 'workflow.yaml'), minimalWorkflow);
    fs.writeFileSync(path.join(railiDir, 'agent-registry.json'), JSON.stringify({}));
    fs.writeFileSync(path.join(railiDir, 'script-registry.json'), JSON.stringify({}));

    registryValidator.validateAgentRegistry.mockImplementation(() => ({}));
    registryValidator.validateScriptRegistry.mockImplementation(() => ({}));
    registryValidator.validateWorkflowReferences.mockImplementation(() => {});
    Runner.mockImplementation(() => ({ run: jest.fn().mockResolvedValue(undefined) }));

    await runCommand(tmpdir, 'clean', { ticket_id: 'PROJ-42', description: 'Do the thing' });

    expect(process.env.RAILI_VAR_TICKET_ID).toBe('PROJ-42');
    expect(process.env.RAILI_VAR_DESCRIPTION).toBe('Do the thing');

    delete process.env.RAILI_VAR_TICKET_ID;
    delete process.env.RAILI_VAR_DESCRIPTION;
  });
});
