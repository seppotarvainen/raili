import {validateWorkflowConfig} from '../../src/workflow/schemaValidator';

describe('schema: error state validation', () => {
  test('throws when declared error state does not exist', () => {
    const cfg = {
      initial: 'start',
      error: 'missing',
      states: {
        start: { type: 'engine' }
      }
    } as any;

    expect(() => validateWorkflowConfig(cfg)).toThrow(/Error state 'missing' does not exist/);
  });

  test('throws when error state is not terminal', () => {
    const cfg = {
      initial: 'start',
      error: 'err',
      states: {
        start: { type: 'engine' },
        err: { type: 'engine', on: { PASSED: 'start' } }
      }
    } as any;

    expect(() => validateWorkflowConfig(cfg)).toThrow(/must be terminal/);
  });

  test('accepts a valid terminal error state', () => {
    const cfg = {
      initial: 'start',
      error: 'err',
      states: {
        start: { type: 'engine' },
        err: { type: 'engine', notify: 'echo hi' }
      }
    } as any;

    expect(() => validateWorkflowConfig(cfg)).not.toThrow();
  });
});

