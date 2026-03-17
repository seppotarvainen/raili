import { runApprovalStep } from '../../src/engine/ApproveStateRunner';
import * as manualHandler from '../../src/handlers/manualHandler';
import * as notifyHandler from '../../src/handlers/notifyHandler';
import { WorkflowContext } from '../../src/types';

jest.mock('../../src/handlers/manualHandler');
jest.mock('../../src/handlers/notifyHandler');

const mockHandleManual = manualHandler.handleManualTransition as jest.MockedFunction<typeof manualHandler.handleManualTransition>;
const mockRunNotify = notifyHandler.runNotify as jest.MockedFunction<typeof notifyHandler.runNotify>;

beforeEach(() => {
  jest.resetAllMocks();
  mockHandleManual.mockResolvedValue({ chosen: 'PASSED', target: 'next', reason: '' });
  mockRunNotify.mockResolvedValue(undefined);
});

describe('variable interpolation in approval blocks', () => {
  test('interpolates variables in approval question', async () => {
    const context: WorkflowContext = {
      stateHistory: [],
      vars: { TICKET_ID: 'PROJ-123', TITLE: 'Fix login bug' },
    };

    const approval = {
      question: 'Did you update ticket ${TICKET_ID}? Title: ${TITLE}',
      PASSED: 'next',
      FAILED: 'back',
    };

    await runApprovalStep('review', approval, { cwd: '/tmp', context });

    expect(mockHandleManual).toHaveBeenCalledWith({
      question: 'Did you update ticket PROJ-123? Title: Fix login bug',
      options: { PASSED: 'next', FAILED: 'back' },
    });
  });

  test('missing variable in question becomes empty string', async () => {
    const context: WorkflowContext = {
      stateHistory: [],
      vars: { TICKET_ID: 'PROJ-123' },
    };

    const approval = {
      question: 'Ticket: ${TICKET_ID}, Title: ${UNDEFINED_VAR}',
      PASSED: 'next',
      FAILED: 'back',
    };

    await runApprovalStep('review', approval, { cwd: '/tmp', context });

    expect(mockHandleManual).toHaveBeenCalledWith({
      question: 'Ticket: PROJ-123, Title: ',
      options: { PASSED: 'next', FAILED: 'back' },
    });
  });

  test('handles multiline approval question with variables', async () => {
    const context: WorkflowContext = {
      stateHistory: [],
      vars: { TICKET_ID: 'PROJ-999', DESCRIPTION: 'Fix critical bug' },
    };

    const approval = {
      question: `Did you update the ticket?
Ticket: \${TICKET_ID}
Description: \${DESCRIPTION}

Please confirm.`,
      PASSED: 'next',
      FAILED: 'back',
    };

    await runApprovalStep('review', approval, { cwd: '/tmp', context });

    const expectedQuestion = `Did you update the ticket?
Ticket: PROJ-999
Description: Fix critical bug

Please confirm.`;

    expect(mockHandleManual).toHaveBeenCalledWith({
      question: expectedQuestion,
      options: { PASSED: 'next', FAILED: 'back' },
    });
  });


  test('handles escaped dollar signs in approval question', async () => {
    const context: WorkflowContext = {
      stateHistory: [],
      vars: { VAR: 'value' },
    };

    const approval = {
      question: 'Price: $$100 and variable: ${VAR}',
      PASSED: 'next',
      FAILED: 'back',
    };

    await runApprovalStep('review', approval, { cwd: '/tmp', context });

    expect(mockHandleManual).toHaveBeenCalledWith({
      question: 'Price: $100 and variable: value',
      options: { PASSED: 'next', FAILED: 'back' },
    });
  });

  test('works with no variables defined', async () => {
    const context: WorkflowContext = {
      stateHistory: [],
      vars: {},
    };

    const approval = {
      question: 'Is everything ready?',
      PASSED: 'next',
      FAILED: 'back',
    };

    await runApprovalStep('review', approval, { cwd: '/tmp', context });

    expect(mockHandleManual).toHaveBeenCalledWith({
      question: 'Is everything ready?',
      options: { PASSED: 'next', FAILED: 'back' },
    });
  });

  test('works with no context provided', async () => {
    const approval = {
      question: 'Is everything ready?',
      PASSED: 'next',
      FAILED: 'back',
    };

    await runApprovalStep('review', approval, { cwd: '/tmp' });

    expect(mockHandleManual).toHaveBeenCalledWith({
      question: 'Is everything ready?',
      options: { PASSED: 'next', FAILED: 'back' },
    });
  });
});

