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

describe('integration: outputStore behavior', () => {
  it('first run creates both history and .latest.md with identical filtered content (marker)', async () => {
    writeWorkflow(
      tmpDir,
      `initial: code
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
`,
    );

    writeAgentRegistry(tmpDir, { 'raili-coding': { path: '.github/agents/raili-coding.md' } });
    writeScriptRegistry(tmpDir, {});
    writeAgentFile(tmpDir, '.github/agents/raili-coding.md', '---\nmodel: test\n---\n');

    spawn.mockImplementation((cmd: string, args?: any[], opts?: any) => {
      if (cmd === 'copilot') return fakeChild('intro\nSUMMARY:\nline1\nline2\n', '', 0);
      return fakeChild('', '', 0);
    });

    await runCommand(tmpDir, 'clean', {});

    const historyPath = path.join(tmpDir, '.raili', 'main', 'outputs', 'code.md');
    const latestPath = path.join(tmpDir, '.raili', 'main', 'outputs', 'code.latest.md');

    expect(fs.existsSync(historyPath)).toBe(true);
    expect(fs.existsSync(latestPath)).toBe(true);

    const historyContent = fs.readFileSync(historyPath, 'utf8');
    const latestContent = fs.readFileSync(latestPath, 'utf8');

    expect(historyContent).toContain('line1\nline2');
    expect(latestContent).toContain('line1\nline2');
  });

  it('second run appends to history and overwrites .latest.md with only the new run', async () => {
    writeWorkflow(
      tmpDir,
      `initial: code
states:
  code:
    type: agent
    agent: raili-coding
    output:
      store: true
    on:
      PASSED: done
  done:
    type: engine
`,
    );

    writeAgentRegistry(tmpDir, { 'raili-coding': { path: '.github/agents/raili-coding.md' } });
    writeScriptRegistry(tmpDir, {});
    writeAgentFile(tmpDir, '.github/agents/raili-coding.md', '---\nmodel: test\n---\n');

    // First run returns initial output
    spawn.mockImplementation((cmd: string, args?: any[], opts?: any) => {
      if (cmd === 'copilot') return fakeChild('Analysis result\nComplete', '', 0);
      return fakeChild('', '', 0);
    });

    await runCommand(tmpDir, 'clean', {});

    const historyPath = path.join(tmpDir, '.raili', 'main', 'outputs', 'code.md');
    const latestPath = path.join(tmpDir, '.raili', 'main', 'outputs', 'code.latest.md');

    expect(fs.existsSync(historyPath)).toBe(true);
    expect(fs.existsSync(latestPath)).toBe(true);

    const latestContent1 = fs.readFileSync(latestPath, 'utf8');
    expect(latestContent1).toContain('Analysis result');

    // Second run returns updated output
    spawn.mockImplementation((cmd: string, args?: any[], opts?: any) => {
      if (cmd === 'copilot') return fakeChild('Updated analysis\nDone', '', 0);
      return fakeChild('', '', 0);
    });

    // Continue run to resume the workflow and run the state again
    await runCommand(tmpDir, 'continue', {});

    const historyContent2 = fs.readFileSync(historyPath, 'utf8');
    const latestContent2 = fs.readFileSync(latestPath, 'utf8');

    // History should contain both outputs
    expect(historyContent2).toContain('Analysis result');
    expect(historyContent2).toContain('Updated analysis');

    // Latest should contain only the new run
    expect(latestContent2).toContain('Updated analysis');
    expect(latestContent2).not.toContain('Analysis result');
  });

  it('marker extraction and tail filtering applied identically to both files', async () => {
    writeWorkflow(
      tmpDir,
      `initial: code
states:
  code:
    type: agent
    agent: raili-coding
    output:
      store: true
      marker: 'RESULT:'
      tail: 2
    on:
      PASSED: done
  done:
    type: engine
`,
    );

    writeAgentRegistry(tmpDir, { 'raili-coding': { path: '.github/agents/raili-coding.md' } });
    writeScriptRegistry(tmpDir, {});
    writeAgentFile(tmpDir, '.github/agents/raili-coding.md', '---\nmodel: test\n---\n');

    spawn.mockImplementation((cmd: string, args?: any[], opts?: any) => {
      if (cmd === 'copilot')
        return fakeChild('preamble\nRESULT:\nline1\nline2\nline3\nline4', '', 0);
      return fakeChild('', '', 0);
    });

    await runCommand(tmpDir, 'clean', {});

    const historyPath = path.join(tmpDir, '.raili', 'main', 'outputs', 'code.md');
    const latestPath = path.join(tmpDir, '.raili', 'main', 'outputs', 'code.latest.md');

    const historyContent = fs.readFileSync(historyPath, 'utf8');
    const latestContent = fs.readFileSync(latestPath, 'utf8');

    // After marker extraction the content should be lines 1..4, tail:2 => line3\nline4
    expect(historyContent).toContain('line3\nline4');
    expect(latestContent).toContain('line3\nline4');
    expect(historyContent).not.toContain('preamble');
    expect(latestContent).not.toContain('preamble');
  });
});
