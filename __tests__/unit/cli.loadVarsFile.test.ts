import { loadVarsFile } from '../../src/cli';
import * as fs from 'fs';
import * as yaml from 'js-yaml';

jest.mock('fs');
jest.mock('js-yaml');

describe('loadVarsFile', () => {
  const cwd = '/project';
  const railiDir = `${cwd}/.raili`;

  beforeEach(() => {
    jest.resetAllMocks();
  });

  test('reads default vars.yaml when no workflowPath provided', () => {
    (fs.existsSync as jest.Mock).mockImplementation((p: string) => p === `${railiDir}/vars.yaml`);
    (fs.readFileSync as jest.Mock).mockReturnValue('ticket_id: PROJ-1\nbranch: main');
    (yaml.load as jest.Mock).mockReturnValue({ ticket_id: 'PROJ-1', branch: 'main', extra: 'x' });

    const res = loadVarsFile(cwd, ['ticket_id', 'branch']);
    expect(res).toEqual({ ticket_id: 'PROJ-1', branch: 'main' });
  });

  test('prefers vars.<suffix>.yaml when workflowPath contains workflow- prefix', () => {
    (fs.existsSync as jest.Mock).mockImplementation((p: string) => p === `${railiDir}/vars.dev.yaml`);
    (fs.readFileSync as jest.Mock).mockReturnValue('ticket_id: DEV-1');
    (yaml.load as jest.Mock).mockReturnValue({ ticket_id: 'DEV-1' });

    const res = loadVarsFile(cwd, ['ticket_id'], 'workflow-dev.yaml');
    expect(res).toEqual({ ticket_id: 'DEV-1' });
  });

  test('falls back to vars.yaml when no paired file exists', () => {
    (fs.existsSync as jest.Mock).mockImplementation((p: string) => p === `${railiDir}/vars.yaml`);
    (fs.readFileSync as jest.Mock).mockReturnValue('ticket_id: FALLBACK');
    (yaml.load as jest.Mock).mockReturnValue({ ticket_id: 'FALLBACK' });

    const res = loadVarsFile(cwd, ['ticket_id'], 'other-workflow.yaml');
    expect(res).toEqual({ ticket_id: 'FALLBACK' });
  });
});
