import fs from 'fs';
import path from 'path';
import { validateWorkflowNesting } from '../../src/registry/registryValidator';

describe('validateWorkflowNesting', () => {
  const workflowDir = '/tmp/raili-test';

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('missing sub-workflow file throws', () => {
    const wf: any = {
      initial: 'start',
      states: {
        start: { type: 'engine' },
        groupState: { type: 'group', group: './sub.yaml' },
      },
    };

    jest.spyOn(fs, 'existsSync').mockReturnValue(false);

    expect(() => validateWorkflowNesting(wf, workflowDir)).toThrow(/references missing sub-workflow/);
  });

  test('sub-workflow contains nested group -> throws', () => {
    const wf: any = {
      initial: 'start',
      states: {
        groupState: { type: 'group', group: './sub.yaml' },
      },
    };

    const yamlContent = `states:\n  inner:\n    type: group\n`;
    jest.spyOn(fs, 'existsSync').mockReturnValue(true);
    jest.spyOn(fs, 'readFileSync').mockReturnValue(yamlContent as any);

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

    const yamlContent = `states:\n  inner:\n    type: engine\n    out: true\n`;
    jest.spyOn(fs, 'existsSync').mockReturnValue(true);
    jest.spyOn(fs, 'readFileSync').mockReturnValue(yamlContent as any);

    expect(() => validateWorkflowNesting(wf, workflowDir)).toThrow(/Main workflow references inner state 'inner'/);
  });

  test('sub-workflow with no out:true -> throws', () => {
    const wf: any = {
      initial: 'start',
      states: {
        groupState: { type: 'group', group: './sub.yaml' },
      },
    };

    const yamlContent = `states:\n  a:\n    type: engine\n  b:\n    type: agent\n`;
    jest.spyOn(fs, 'existsSync').mockReturnValue(true);
    jest.spyOn(fs, 'readFileSync').mockReturnValue(yamlContent as any);

    expect(() => validateWorkflowNesting(wf, workflowDir)).toThrow(/must declare at least one state with 'out: true'/);
  });
});
