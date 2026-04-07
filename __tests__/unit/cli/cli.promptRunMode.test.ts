import { promptRunMode } from '../../../src/cli';
import * as contextModule from '../../../src/context/context';

jest.mock('../../../src/context/context');

const mockedLoadContext = contextModule.loadContext as unknown as jest.Mock;
const mockedGetCurrentState = contextModule.getCurrentState as unknown as jest.Mock;

describe('promptRunMode', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('returns clean when workflow/context is missing for provided workflow', async () => {
    mockedLoadContext.mockReturnValue({ stateHistory: [] });
    mockedGetCurrentState.mockReturnValue(null);

    await expect(promptRunMode(process.cwd(), 'test')).resolves.toBe('clean');
  });

  test('returns clean when workflow exists but has no current state', async () => {
    mockedLoadContext.mockReturnValue({ stateHistory: [] });
    mockedGetCurrentState.mockReturnValue(null);

    await expect(promptRunMode(process.cwd(), 'test')).resolves.toBe('clean');
  });
});
