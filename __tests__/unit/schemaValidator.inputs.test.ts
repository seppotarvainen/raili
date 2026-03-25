import {validateWorkflowConfig} from "../../src/workflow/schemaValidator";

describe('schemaValidator inputs referencing', () => {
  test('state uses ${...} syntax for undeclared var in a command string -> validation error', () => {
    // command states use $RAILI_VAR_* shell syntax; using ${VAR} is a mistake that should be caught
    const config: any = {
      initial: 'start',
      inputs: ['declared'],
      states: {
        start: {
          type: 'command',
          command: 'echo ${UNDECLARED}',
          on: { PASSED: 'done', FAILED: 'done' },
        },
        done: { type: 'engine' },
      },
    };

    expect(() => validateWorkflowConfig(config)).toThrow(/undeclared variable '\$\{UNDECLARED\}'/i);
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

  test('agent prompt with optional/conditional var not in inputs -> no error (throwOnMissing:false at runtime)', () => {
    const config: any = {
      initial: 'code',
      inputs: ['title'],
      states: {
        code: {
          type: 'agent',
          agent: 'coder',
          prompt: '${OPTIONAL_CONTEXT}\nWork on ${title}',
          learn_from: [{ var: '${OPTIONAL_CONTEXT}' }],
          on: { PASSED: 'done' },
        },
        done: { type: 'engine' },
      },
    };

    expect(() => validateWorkflowConfig(config)).not.toThrow();
  });

  test('approval question with optional var -> no error (throwOnMissing:false at runtime)', () => {
    const config: any = {
      initial: 'review',
      inputs: [],
      states: {
        review: {
          type: 'engine',
          approval: {
            question: 'Commit ${OPTIONAL_ID}?',
            PASSED: 'done',
            FAILED: 'done',
          },
        },
        done: { type: 'engine' },
      },
    };

    expect(() => validateWorkflowConfig(config)).not.toThrow();
  });
});
