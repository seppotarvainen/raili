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

  test('state references variable exposed by a preceding state -> no error', () => {
    const config: any = {
      initial: 'get_id',
      inputs: ['title'],
      states: {
        get_id: {
          type: 'script',
          script: 'next_id',
          expose: ['id'],
          on: { PASSED: 'use_id', FAILED: 'use_id' },
        },
        use_id: {
          type: 'agent',
          agent: 'analyzer',
          prompt: 'Title: ${title}, ID: ${id}',
        },
      },
    };

    expect(() => validateWorkflowConfig(config)).not.toThrow();
  });

  test('state references feedback.expose_var from another state -> no error', () => {
    const config: any = {
      initial: 'ask',
      inputs: [],
      states: {
        ask: {
          type: 'engine',
          feedback: {
            question: 'Any notes?',
            expose_var: 'notes',
          },
          on: { PASSED: 'use_notes' },
        },
        use_notes: {
          type: 'agent',
          agent: 'analyzer',
          prompt: 'Notes: ${notes}',
        },
      },
    };

    expect(() => validateWorkflowConfig(config)).not.toThrow();
  });
});
