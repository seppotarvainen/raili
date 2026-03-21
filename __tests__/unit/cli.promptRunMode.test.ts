import {promptRunMode} from '../../src/cli';
import * as contextModule from '../../src/context/context';

jest.mock('../../src/context/context');

const mockedLoadContext = contextModule.loadContext as unknown as jest.Mock;
const mockedGetCurrentState = contextModule.getCurrentState as unknown as jest.Mock;

describe('promptRunMode', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  test('throws when workflow/context is missing for provided workflow', async () => {
    mockedLoadContext.mockImplementation(() => {
      throw new Error("Missing context.json for workflow 'test'. Cannot run without an existing context.");
    });

    await expect(promptRunMode(process.cwd(), 'test')).rejects.toThrow(
      "Missing context.json for workflow 'test'. Cannot run without an existing context.",
    );
  });

  test('returns clean when workflow exists but has no current state', async () => {
    mockedLoadContext.mockReturnValue({ stateHistory: [] });
    mockedGetCurrentState.mockReturnValue(null);

    await expect(promptRunMode(process.cwd(), 'test')).resolves.toBe('clean');
  });

  test('throws when context.json is missing for an existing workflow directory', async () => {
    mockedLoadContext.mockImplementation(() => {
      throw new Error("Missing context.json for workflow 'test'. Cannot run without an existing context.");
    });

    await expect(promptRunMode(process.cwd(), 'test')).rejects.toThrow(
      "Missing context.json for workflow 'test'. Cannot run without an existing context.",
    );
  });
});
