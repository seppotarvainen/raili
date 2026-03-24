import fs from 'fs';
import path from 'path';
import { validateWorkflowNesting } from '../../src/registry/registryValidator';

describe('validateWorkflowNesting', () => {
  const workflowDir = '/tmp/raili-test';

  beforeEach(() => {
    jest.resetAllMocks();
  });

  test('missing sub-workflow file throws', () => {
    const wf: any = {
      initial: 'start',
      states: {
        start: { type: 'engine' },
        groupState: { type: 'group', group: './sub.yaml' },
      },
    };

    const resolved = path.resolve(workflowDir, './sub.yaml');
    (fs.existsSync as any) = jest.fn((p: string) => false);

    expect(() => validateWorkflowNesting(wf, workflowDir)).toThrow(/references missing sub-workflow/);
  });

  test('sub-workflow contains nested group -> throws', () => {
    const wf: any = {
      initial: 'start',
      states: {
        groupState: { type: 'group', group: './sub.yaml' },
      },
    };

    (fs.existsSync as any) = jest.fn(() => true);
    const yamlContent = `states:\n  inner:\n    type: group\n`;
    (fs.readFileSync as any) = jest.fn(() => yamlContent);

    expect(() => validateWorkflowNesting(wf, workflowDir)).toThrow(/contains nested 'group'/);
  });

  test('main workflow references inner state -> throws with helpful message', () => {
    const wf: any = {
      initial: 'start',
      states: {
        start: { type: 'engine', transitions: { go: 'inner' } },
        groupState: { type: 'group', group: './sub.yaml' },
      },
    };

    (fs.existsSync as any) = jest.fn(() => true);
    const yamlContent = `states:\n  inner:\n    type: engine\n    out: true\n`;
    (fs.readFileSync as any) = jest.fn(() => yamlContent);

    expect(() => validateWorkflowNesting(wf, workflowDir)).toThrow(/Main workflow references inner state 'inner'/);
  });

  test('sub-workflow with no out:true -> throws', () => {
    const wf: any = {
      initial: 'start',
      states: {
        groupState: { type: 'group', group: './sub.yaml' },
      },
    };

    (fs.existsSync as any) = jest.fn(() => true);
    const yamlContent = `states:\n  a:\n    type: engine\n  b:\n    type: agent\n`;
    (fs.readFileSync as any) = jest.fn(() => yamlContent);

    expect(() => validateWorkflowNesting(wf, workflowDir)).toThrow(/must declare at least one state with 'out: true'/);
  });
});
