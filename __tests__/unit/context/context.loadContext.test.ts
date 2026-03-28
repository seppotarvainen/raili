import {loadContext} from '../../../src/context/context';
import * as pathUtils from '../../../src/context/pathUtils';

jest.mock('../../../src/context/pathUtils');

const mockFs: any = {
  existsSync: jest.fn(),
  readFileSync: jest.fn(),
};

jest.mock('../../../src/infrastructure/fileSystemProvider', () => ({
  getFileSystem: () => mockFs,
}));

const mockedResolve = pathUtils.resolveWorkflowDir as unknown as jest.Mock;

describe('loadContext', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  test('parses context.json when file exists and valid', () => {
    mockedResolve.mockReturnValue('/repo/.raili/test');
    mockFs.existsSync.mockReturnValue(true);
    mockFs.readFileSync.mockReturnValue(JSON.stringify({ stateHistory: [], vars: { a: 'b' }, approvals: {} }));

    const ctx = loadContext(process.cwd(), 'test');
    expect(ctx.stateHistory).toEqual([]);
    expect(ctx.vars).toEqual({ a: 'b' });
  });

  test('throws for malformed JSON in context.json', () => {
    mockedResolve.mockReturnValue('/repo/.raili/test');
    mockFs.existsSync.mockReturnValue(true);
    mockFs.readFileSync.mockReturnValue('{ not valid json }');

    expect(() => loadContext(process.cwd(), 'test')).toThrow();
  });
});
