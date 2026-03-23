import fs from 'fs';
import path from 'path';
import os from 'os';
import readline from 'readline';
import {collectVars} from '../../../src/cli';
import * as workflowLoader from '../../../src/workflow/workflowLoader';

jest.mock('readline');

describe('collectVars', () => {
  let tmpdir: string;
  let railiDir: string;

  beforeEach(() => {
    tmpdir = fs.mkdtempSync(path.join(os.tmpdir(), 'raili-cli-test-'));
    railiDir = path.join(tmpdir, '.raili');
    fs.mkdirSync(path.join(railiDir, 'main'), { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tmpdir, { recursive: true, force: true });
    jest.resetAllMocks();
  });

  test('prints description and prompts for missing inputs', async () => {
    // Mock workflow loader to return inputs with descriptions
    jest.spyOn(workflowLoader, 'loadWorkflowConfig').mockImplementation(() => ({
      initial: 'start',
      states: {},
      inputs: [ { name: 'ticket_id', description: 'Ticket identifier\nMulti-line description' }, { name: 'branch', description: 'Git branch name' } ] as any
    } as any));

    // Prepare readline mock
    const rl = {
      question: jest.fn((q, cb) => cb('PROJ-123')),
      close: jest.fn()
    } as any;

    (readline.createInterface as jest.Mock).mockReturnValue(rl);

    const result = await (collectVars as any)(tmpdir, {});
    expect(result.ticket_id).toBe('PROJ-123');
  });
});
