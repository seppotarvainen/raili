import fs from 'fs';
import path from 'path';
import { runCommand } from '../../src/run';
import {
  cleanupRailiEnvVars,
  cleanupTmpWorkspace,
  createTmpWorkspace,
  fakeChild,
  writeAgentFile,
  writeAgentRegistry,
  writeScriptRegistry,
  writeWorkflow,
} from './testUtils';

jest.mock('child_process', () => ({ spawn: jest.fn() }));
const { spawn } = require('child_process');

let tmpDir: string;

beforeEach(() => {
  tmpDir = createTmpWorkspace();
  spawn.mockImplementation(() => fakeChild('', '', 0));
});

afterEach(() => {
  cleanupTmpWorkspace(tmpDir);
  cleanupRailiEnvVars();
  spawn.mockReset();
});

describe('integration: outputStore marker extraction', () => {
  it('agent state stores content after marker to outputs file', async () => {
    writeWorkflow(tmpDir, `initial: code
states:
  code:
    type: agent
    agent: raili-coding
    output:
      store: true
      marker: 'SUMMARY:'
    on:
      PASSED: done
  done:
    type: engine
`);

    writeAgentRegistry(tmpDir, { 'raili-coding': { path: '.github/agents/raili-coding.md' } });
    writeScriptRegistry(tmpDir, {});
    writeAgentFile(tmpDir, '.github/agents/raili-coding.md', '---\nmodel: test\n---\n');

    spawn.mockImplementation((cmd: string, args?: any[], opts?: any) => {
      if (cmd === 'copilot') return fakeChild('intro\nSUMMARY:\nline1\nline2\n', '', 0);
      return fakeChild('', '', 0);
    });

    await runCommand(tmpDir, 'clean', {});

    const p = path.join(tmpDir, '.raili', 'main', 'outputs', 'code.md');
    expect(fs.existsSync(p)).toBe(true);
    const content = fs.readFileSync(p, 'utf8');
    expect(content).toContain('line1\nline2');
  });
});
