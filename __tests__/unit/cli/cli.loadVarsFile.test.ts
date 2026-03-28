import {loadVarsFile} from '../../../src/cli';
import * as yaml from 'js-yaml';
import * as pathUtils from '../../../src/context/pathUtils';

const mockFs: any = {
  existsSync: jest.fn(),
  statSync: jest.fn(),
  readFileSync: jest.fn(),
};

jest.mock('js-yaml');
jest.mock('../../../src/context/pathUtils');

jest.mock('../../../src/infrastructure/fileSystemProvider', () => ({
  getFileSystem: () => mockFs,
}));

const mockedResolve = pathUtils.resolveWorkflowDir as jest.Mock;

describe('loadVarsFile', () => {
  const cwd = '/project';
  const railiDir = `${cwd}/.raili`;

  beforeEach(() => {
    jest.resetAllMocks();
    (mockFs.statSync as jest.Mock).mockReturnValue({ isDirectory: () => false });
  });

  test('reads vars.yaml from main workflow dir when no workflowPath provided', () => {
    mockedResolve.mockReturnValue(`${railiDir}/main`);
    (mockFs.existsSync as jest.Mock).mockImplementation((p: string) => p === `${railiDir}/main/vars.yaml`);
    (mockFs.readFileSync as jest.Mock).mockReturnValue('ticket_id: PROJ-1\nbranch: main');
    (yaml.load as jest.Mock).mockReturnValue({ ticket_id: 'PROJ-1', branch: 'main', extra: 'x' });

    const res = loadVarsFile(cwd, ['ticket_id', 'branch']);
    expect(res).toEqual({ ticket_id: 'PROJ-1', branch: 'main' });
  });

  test('reads vars.yaml from named workflow dir when workflowPath provided', () => {
    mockedResolve.mockReturnValue(`${railiDir}/dev`);
    (mockFs.existsSync as jest.Mock).mockImplementation((p: string) => p === `${railiDir}/dev/vars.yaml`);
    (mockFs.readFileSync as jest.Mock).mockReturnValue('ticket_id: DEV-1');
    (yaml.load as jest.Mock).mockReturnValue({ ticket_id: 'DEV-1' });

    const res = loadVarsFile(cwd, ['ticket_id'], 'dev');
    expect(res).toEqual({ ticket_id: 'DEV-1' });
  });

  test('falls back to .raili/vars.yaml when workflow vars.yaml not found', () => {
    mockedResolve.mockReturnValue(`${railiDir}/dev`);
    (mockFs.existsSync as jest.Mock).mockImplementation((p: string) => p === `${railiDir}/vars.yaml`);
    (mockFs.readFileSync as jest.Mock).mockReturnValue('ticket_id: FALLBACK');
    (yaml.load as jest.Mock).mockReturnValue({ ticket_id: 'FALLBACK' });

    const res = loadVarsFile(cwd, ['ticket_id'], 'dev');
    expect(res).toEqual({ ticket_id: 'FALLBACK' });
  });
});
