jest.mock('../../../src/context/outputStore', () => ({
  saveOutput: jest.fn(),
  saveLatestOutput: jest.fn(),
  outputPath: jest.fn(),
}));

import { storeOutput } from '../../../src/runner/stateRunnerUtils';
import { StateDef } from '../../../src/types';
import * as outputStore from '../../../src/context/outputStore';

const mockedSaveOutput = outputStore.saveOutput as jest.MockedFunction<typeof outputStore.saveOutput>;
const mockedSaveLatest = outputStore.saveLatestOutput as jest.MockedFunction<typeof outputStore.saveLatestOutput>;

describe('storeOutput', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('calls saveOutput and saveLatestOutput when output present', () => {
    const cwd = '/tmp';
    const state: StateDef = {
      id: 's',
      config: {
        type: 'script',
        script: 'x',
        output: { store: true },
      },
    } as any;

    const result = { success: true, stdout: 'out', stderr: 'err' } as any;

    storeOutput(cwd, state, result);

    expect(mockedSaveOutput).toHaveBeenCalledTimes(1);
    expect(mockedSaveLatest).toHaveBeenCalledTimes(1);

    const combined = 'out\nerr';
    expect(mockedSaveOutput).toHaveBeenCalledWith(cwd, state.id, combined, state.config.output, undefined);
    expect(mockedSaveLatest).toHaveBeenCalledWith(cwd, state.id, combined, state.config.output, undefined);
  });

  test('does nothing when no output configured', () => {
    const cwd = '/tmp';
    const state: StateDef = {
      id: 's',
      config: {
        type: 'script',
        script: 'x',
      },
    } as any;

    const result = { success: true, stdout: 'out', stderr: '' } as any;

    storeOutput(cwd, state, result);

    expect(mockedSaveOutput).not.toHaveBeenCalled();
    expect(mockedSaveLatest).not.toHaveBeenCalled();
  });
});
