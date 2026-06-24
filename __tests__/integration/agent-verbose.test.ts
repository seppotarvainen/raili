import fs from 'fs';
import path from 'path';
import { runCommand } from '../../src/run';
import { loadContext } from '../../src/context/context';
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
});

afterEach(() => {
  cleanupTmpWorkspace(tmpDir);
  cleanupRailiEnvVars();
  spawn.mockReset();
});

describe('agent verbose output', () => {
  it('prints verbose block before agent execution when verbose=true', async () => {
    writeWorkflow(
      tmpDir,
      `
initial: analyze
states:
  analyze:
    type: agent
    agent: test_agent
    prompt: "Analyze the code"
    continue: complete
  complete:
    type: engine
`,
    );
    writeAgentRegistry(tmpDir, { test_agent: { path: './agents/test.agent.md' } });
    writeScriptRegistry(tmpDir, {});
    writeAgentFile(tmpDir, 'agents/test.agent.md', 'Agent instructions');

    // Capture console.log timestamps and messages
    const originalLog = console.log;
    const logs: { t: number; msg: string }[] = [];
    console.log = (m?: any) => logs.push({ t: Date.now(), msg: String(m) });

    let spawnTime = 0;
    spawn.mockImplementation((cmd: string) => {
      if (cmd === 'copilot') {
        spawnTime = Date.now();
        return fakeChild('analysis\ncomplete', '', 0);
      }
      return fakeChild('', '', 0);
    });

    try {
      await runCommand(
        tmpDir,
        'clean',
        {},
        undefined,
        false,
        undefined,
        undefined,
        undefined,
        true,
      );
    } finally {
      // restore console
      console.log = originalLog;
    }

    // Ensure verbose block was printed
    const verboseEntry = logs.find((l) => l.msg.includes('VERBOSE: Agent context'));
    expect(verboseEntry).toBeDefined();
    expect(spawnTime).toBeGreaterThan(0);
    // Verbose output should occur before copilot was spawned
    expect(verboseEntry!.t).toBeLessThan(spawnTime);

    // Copilot was invoked
    const copilotCall = spawn.mock.calls.find((c: any[]) => c[0] === 'copilot');
    expect(copilotCall).toBeDefined();

    const ctx = loadContext(tmpDir);
    expect(ctx.stateHistory[ctx.stateHistory.length - 1].state).toBe('complete');
  });
});
