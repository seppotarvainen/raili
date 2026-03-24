import {validateWorkflowConfig} from "../../src/workflow/schemaValidator";

describe('schemaValidator inputs referencing', () => {
  test('state references undeclared variable -> validation error', () => {
    const config: any = {
      initial: 'start',
      inputs: ['declared'],
      states: {
        start: {
          type: 'agent',
          agent: 'analyzer',
          prompt: 'Analyze ${UNDECLARED}',
        },
      },
    };

    expect(() => validateWorkflowConfig(config)).toThrow(/UNDECLARED/);
  });
});
