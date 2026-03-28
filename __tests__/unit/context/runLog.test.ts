import {appendRunLog} from '../../../src/context/runLog';
import * as contextModule from '../../../src/context/context';

import { IFileSystem } from '../../../src/infrastructure/fileSystem';

const mockFs: Partial<IFileSystem> = {
  appendFileSync: jest.fn(),
  readFileSync: jest.fn(),
} as any;

jest.mock('../../../src/infrastructure/fileSystemProvider', () => ({
  getFileSystem: () => mockFs,
}));

describe('runLog.appendRunLog', () => {
  const mockedAppend = (mockFs.appendFileSync as jest.MockedFunction<any>);

  beforeEach(() => {
    mockedAppend.mockReset();
  });

  it('writes expected JSON line with filtered entries and vars', () => {
    const fakeCtx: any = {
      vars: { ticket_id: 'T1', secret: 'X' },
      stateHistory: [
        // old entry before runStart
        { state: 'old', enteredAt: '2025-01-01T00:00:00Z', meta: {} },
        // entries in run
        { state: 'start', enteredAt: '2026-01-01T10:00:00Z', meta: {} },
        { state: 'review', enteredAt: '2026-01-01T10:01:00Z', meta: { approval: { chosen: 'FAILED' } } },
        { state: 'done', enteredAt: '2026-01-01T10:02:00Z', meta: { success: true } },
      ],
    };

    jest.spyOn(contextModule, 'loadContext').mockImplementation(() => fakeCtx as any);

    const workflowConfig: any = { inputs: [{ name: 'ticket_id', log: true }, { name: 'branch', log: false }] };

    appendRunLog('/repo', 'main', '2026-01-01T10:00:00Z', workflowConfig);

    expect(mockedAppend).toHaveBeenCalledTimes(1);
    const calledArgs = mockedAppend.mock.calls[0];
    const line = calledArgs[1] as string;
    const obj = JSON.parse(line);
    expect(obj.runId).toBe('2026-01-01T10:00:00Z');
    expect(obj.vars).toEqual({ ticket_id: 'T1' });
    expect(obj.states).toBe(3);
    expect(obj.loops).toBe(0);
    expect(obj.approvalFailures).toBe(1);
    expect(obj.terminalState).toBe('done');
    expect(obj.success).toBe(true);
    expect(typeof obj.duration).toBe('number');
    expect(Number.isInteger(obj.duration)).toBe(true);
  });

  it('subtracts waitMs from duration when present', () => {
    const fakeCtx: any = {
      vars: {},
      stateHistory: [
        { state: 'start', enteredAt: '2026-01-01T10:00:00Z', meta: {} },
        { state: 'review', enteredAt: '2026-01-01T10:01:00Z', meta: { approval: { chosen: 'PASSED' }, waitMs: 30000 } },
        { state: 'done', enteredAt: '2026-01-01T10:02:00Z', meta: { success: true } },
      ],
    };

    jest.spyOn(contextModule, 'loadContext').mockImplementation(() => fakeCtx as any);

    appendRunLog('/repo', 'main', '2026-01-01T10:00:00Z', { inputs: [] } as any);

    const calledArgs = mockedAppend.mock.calls[0];
    const obj = JSON.parse(calledArgs[1] as string);
    // run wall time would be 2 minutes (120000ms) from start -> done, minus 30000 wait = 90000
    expect(obj.waitMs).toBe(30000);
    expect(obj.duration).toBe(90000);
  });
});
