import { WorkflowConfig } from '../../src/types';
import { validateWorkflowReferences } from '../../src/registryValidator';

jest.mock('../../src/agentRegistry');
jest.mock('../../src/scriptRegistry');

describe('Feedback feature validation', () => {
  test('missing expose_var causes validation error', () => {
    const wf: any = {
      initial: 'start',
      states: {
        start: { type: 'engine', feedback: { question: 'q?' } },
      },
    } as WorkflowConfig;
    expect(() => validateWorkflowReferences(wf, {}, {})).toThrow(/feedback.expose_var must be provided/);
  });

  test('expose_var collision with inputs triggers error', () => {
    const wf: any = {
      initial: 'start',
      inputs: [{ name: 'note' }],
      states: {
        start: { type: 'engine', feedback: { expose_var: 'note' } },
      },
    } as WorkflowConfig;
    expect(() => validateWorkflowReferences(wf, {}, {})).toThrow(/conflicts with declared workflow input/);
  });
});

describe('Feedback prompt', () => {
  const OLD = process.env;
  beforeEach(() => {
    jest.resetModules();
    process.env = { ...OLD };
  });
  afterAll(() => {
    process.env = OLD;
  });

  test('RAILI_FEEDBACK_ var bypasses stdin', async () => {
    // Import module fresh to ensure env read happens at call-time
    process.env.RAILI_FEEDBACK_TESTVAL = 'automated value';
    const { handleFeedbackPrompt } = await import('../../src/handlers/manualHandler');
    const val = await handleFeedbackPrompt({ expose_var: 'testval' as any });
    expect(val).toBe('automated value');
  });

  test('required re-prompts until non-empty (single-line)', async () => {
    // Mock readline to simulate empty then non-empty responses
    const answers = ['   ', 'final answer'];
    jest.doMock('readline', () => ({
      createInterface: () => ({
        question: (_q: string, cb: (s: string) => void) => {
          const a = answers.shift() as string;
          cb(a);
        },
        close: () => {},
      }),
    }));

    const { handleFeedbackPrompt } = await import('../../src/handlers/manualHandler');
    const val = await handleFeedbackPrompt({ expose_var: 'foo', required: true } as any);
    expect(val).toBe('final answer');
  });

  test('multiline collects lines until /q', async () => {
    // Mock readline for multiline: push two lines then '/q'
    const lines = ['line1', 'line2', '/q'];
    jest.doMock('readline', () => ({
      createInterface: () => ({
        setPrompt: (_p: string) => {},
        prompt: () => {},
        on: (_ev: string, handler: (s: string) => void) => {
          // Simulate immediate delivery of lines
          setTimeout(() => {
            handler(lines.shift() as string);
            handler(lines.shift() as string);
            handler(lines.shift() as string);
          }, 0);
        },
        close: () => {},
      }),
    }));

    const { handleFeedbackPrompt } = await import('../../src/handlers/manualHandler');
    const val = await handleFeedbackPrompt({ expose_var: 'bar', multiline: true } as any);
    expect(val).toBe('line1\nline2');
  });
});
