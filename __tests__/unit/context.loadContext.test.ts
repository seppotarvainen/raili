import { loadContext } from '../../src/context';
import * as pathUtils from '../../src/pathUtils';
import fs from 'fs';

jest.mock('../../src/pathUtils');
jest.mock('fs');

const mockedResolve = pathUtils.resolveWorkflowDir as unknown as jest.Mock;
const mockedFs = fs as unknown as { existsSync: jest.Mock; readFileSync: jest.Mock };

describe('loadContext', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  test('parses context.json when file exists and valid', () => {
    mockedResolve.mockReturnValue('/repo/.raili/test');
    mockedFs.existsSync.mockReturnValue(true);
    mockedFs.readFileSync.mockReturnValue(JSON.stringify({ stateHistory: [], vars: { a: 'b' }, approvals: {} }));

    const ctx = loadContext(process.cwd(), 'test');
    expect(ctx.stateHistory).toEqual([]);
    expect(ctx.vars).toEqual({ a: 'b' });
  });

  test('throws for malformed JSON in context.json', () => {
    mockedResolve.mockReturnValue('/repo/.raili/test');
    mockedFs.existsSync.mockReturnValue(true);
    mockedFs.readFileSync.mockReturnValue('{ not valid json }');

    expect(() => loadContext(process.cwd(), 'test')).toThrow();
  });
});
