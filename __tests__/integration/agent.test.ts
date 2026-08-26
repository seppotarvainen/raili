import fs from 'fs';
import path from 'path';
import { runCommand } from '../../src/run';
import { loadContext } from '../../src/context/context';
import { createCancellationController } from '../../src/cancellation';
import { main } from '../../src/cli';
import { RailiCommand } from '../../src/cli/railiCommand';
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

// ---------------------------------------------------------------------------
// 1. Agent state with transitions routing (last stdout line)
// ---------------------------------------------------------------------------
describe('agent state with transitions routing', () => {
  it('routes via last stdout line and reaches terminal state', async () => {
    writeWorkflow(
      tmpDir,
      `
initial: analyze
states:
  analyze:
    type: agent
    agent: test_agent
    prompt: "Analyze the code"
    transitions:
      approve: done
      reject: rework
  done:
    type: engine
  rework:
    type: engine
`,
    );
    writeAgentRegistry(tmpDir, { test_agent: { path: './agents/test.agent.md' } });
    writeScriptRegistry(tmpDir, {});
    writeAgentFile(tmpDir, 'agents/test.agent.md', 'Agent instructions');

    spawn.mockImplementation((cmd: string) => {
      if (cmd === 'copilot') return fakeChild('some analysis output\napprove', '', 0);
      return fakeChild('', '', 0);
    });

    await runCommand(tmpDir, 'clean', {});

    const copilotCall = spawn.mock.calls.find((c: any[]) => c[0] === 'copilot');
    expect(copilotCall).toBeDefined();
    expect(copilotCall![1]).toEqual(expect.arrayContaining(['--agent=test_agent']));

    const ctx = loadContext(tmpDir);
    expect(ctx.stateHistory[ctx.stateHistory.length - 1].state).toBe('done');
  });
});

describe('agent cancellation', () => {
  it('kills an in-flight agent, persists cancellation metadata, and does not route onward', async () => {
    writeWorkflow(
      tmpDir,
      `
initial: analyze
states:
  analyze:
    type: agent
    agent: test_agent
    prompt: "Analyze the code"
    transitions:
      approve: done
  done:
    type: engine
`,
    );
    writeAgentRegistry(tmpDir, { test_agent: { path: './agents/test.agent.md' } });
    writeScriptRegistry(tmpDir, {});
    writeAgentFile(tmpDir, 'agents/test.agent.md', 'Agent instructions');

    const cancellationController = createCancellationController();
    const child = fakeChild('', '', 0);
    const killSpy = jest.spyOn(child, 'kill');
    spawn.mockImplementation((cmd: string) => {
      if (cmd === 'copilot') {
        cancellationController.requestCancellation();
        return child;
      }
      return fakeChild('', '', 0);
    });

    const run = runCommand(
      tmpDir,
      'clean',
      {},
      undefined,
      false,
      undefined,
      undefined,
      undefined,
      false,
      cancellationController,
    );
    await run;

    expect(spawn.mock.calls.some((call: unknown[]) => call[0] === 'copilot')).toBe(true);
    expect(killSpy).toHaveBeenCalled();
    const ctx = loadContext(tmpDir);
    expect(ctx.stateHistory.map((entry) => entry.state)).not.toContain('done');
    const analyze = ctx.stateHistory.find((entry) => entry.state === 'analyze');
    expect(analyze?.meta?.cancelled).toEqual(expect.any(String));
  });

  it('cancels through the CLI boundary and persists cancellation metadata', async () => {
    writeWorkflow(
      tmpDir,
      `
initial: analyze
states:
  analyze:
    type: agent
    agent: test_agent
    prompt: "Analyze the code"
    transitions:
      approve: done
  done:
    type: engine
`,
    );
    writeAgentRegistry(tmpDir, { test_agent: { path: './agents/test.agent.md' } });
    writeScriptRegistry(tmpDir, {});
    writeAgentFile(tmpDir, 'agents/test.agent.md', 'Agent instructions');

    const child = fakeChild('', '', 0);
    const killSpy = jest.spyOn(child, 'kill');
    spawn.mockImplementation((cmd: string) => {
      if (cmd === 'copilot') {
        process.stdin.emit('data', Buffer.from([0x18]));
        return child;
      }
      return fakeChild('', '', 0);
    });

    const previousCwd = process.cwd();
    process.chdir(tmpDir);
    try {
      await main(new RailiCommand('run'), ['--clean']);
    } finally {
      process.chdir(previousCwd);
    }

    expect(killSpy).toHaveBeenCalled();
    const ctx = loadContext(tmpDir);
    expect(ctx.stateHistory.map((entry) => entry.state)).not.toContain('done');
    const analyze = ctx.stateHistory.find((entry) => entry.state === 'analyze');
    expect(analyze?.meta?.cancelled).toEqual(expect.any(String));
  });
});

// ---------------------------------------------------------------------------
// 2. Agent state with output storage
// ---------------------------------------------------------------------------
describe('agent state with output storage', () => {
  it('stores agent output to .raili/outputs/<stateId>.md', async () => {
    writeWorkflow(
      tmpDir,
      `
initial: analyze
states:
  analyze:
    type: agent
    agent: test_agent
    prompt: "Analyze the code"
    output:
      store: true
    transitions:
      approve: done
  done:
    type: engine
`,
    );
    writeAgentRegistry(tmpDir, { test_agent: { path: './agents/test.agent.md' } });
    writeScriptRegistry(tmpDir, {});
    writeAgentFile(tmpDir, 'agents/test.agent.md', 'Agent instructions');

    spawn.mockImplementation((cmd: string) => {
      if (cmd === 'copilot') return fakeChild('analysis complete\napprove', '', 0);
      return fakeChild('', '', 0);
    });

    await runCommand(tmpDir, 'clean', {});

    // Output file created
    const outputFile = path.join(tmpDir, '.raili', 'main', 'outputs', 'analyze.md');
    expect(fs.existsSync(outputFile)).toBe(true);
    const content = fs.readFileSync(outputFile, 'utf8');
    expect(content).toContain('analysis complete');

    // Terminal state reached
    const ctx = loadContext(tmpDir);
    expect(ctx.stateHistory[ctx.stateHistory.length - 1].state).toBe('done');
  });
});

// ---------------------------------------------------------------------------
// 3. Agent state with variable interpolation in prompt
// ---------------------------------------------------------------------------
describe('agent prompt with variable interpolation', () => {
  it('interpolates ${ticket_id} and sets RAILI_VAR_TICKET_ID', async () => {
    writeWorkflow(
      tmpDir,
      `
initial: analyze
inputs:
  - name: ticket_id
    description: 'Ticket identifier'
states:
  analyze:
    type: agent
    agent: test_agent
    prompt: "Analyze ticket \${ticket_id}"
    transitions:
      done: complete
  complete:
    type: engine
`,
    );
    writeAgentRegistry(tmpDir, { test_agent: { path: './agents/test.agent.md' } });
    writeScriptRegistry(tmpDir, {});
    writeAgentFile(tmpDir, 'agents/test.agent.md', 'Agent instructions');

    let envVarDuringRun: string | undefined;

    spawn.mockImplementation((cmd: string) => {
      if (cmd === 'copilot') {
        envVarDuringRun = process.env.RAILI_VAR_TICKET_ID;
        return fakeChild('done', '', 0);
      }
      return fakeChild('', '', 0);
    });

    await runCommand(tmpDir, 'clean', { ticket_id: 'TICKET-123' });

    expect(envVarDuringRun).toBe('TICKET-123');

    const copilotCall = spawn.mock.calls.find((c: any[]) => c[0] === 'copilot');
    const args = copilotCall![1] as string[];
    const promptIdx = args.indexOf('--prompt');
    expect(args[promptIdx + 1]).toContain('Analyze ticket TICKET-123');

    const ctx = loadContext(tmpDir);
    expect(ctx.stateHistory[ctx.stateHistory.length - 1].state).toBe('complete');
  });
});

// ---------------------------------------------------------------------------
// 4. Agent state with notify hook and approval
// ---------------------------------------------------------------------------
describe('agent state followed by approval', () => {
  it('runs agent, then approval routes to the correct next state', async () => {
    writeWorkflow(
      tmpDir,
      `
initial: analyze
states:
  analyze:
    type: agent
    agent: test_agent
    notify: "echo 'starting analysis'"
    approval:
      question: "Is the analysis correct?"
      PASSED: deploy
      FAILED: redo
  deploy:
    type: engine
  redo:
    type: engine
`,
    );
    writeAgentRegistry(tmpDir, { test_agent: { path: './agents/test.agent.md' } });
    writeScriptRegistry(tmpDir, {});
    writeAgentFile(tmpDir, 'agents/test.agent.md', 'Agent instructions');

    spawn.mockImplementation((cmd: string) => {
      if (cmd === 'copilot') return fakeChild('agent output here', '', 0);
      return fakeChild('', '', 0);
    });

    // Accept the approval
    process.env.RAILI_MANUAL_CHOICE = 'PASSED';

    await runCommand(tmpDir, 'clean', {});

    delete process.env.RAILI_MANUAL_CHOICE;

    // Notify was fired (sh -c "echo 'starting analysis'")
    const shCalls = spawn.mock.calls.filter((c: any[]) => c[0] === 'sh');
    const commands = shCalls.map((c: any[]) => c[1][1]);
    expect(commands).toContain("echo 'starting analysis'");

    // Copilot was called
    const copilotCall = spawn.mock.calls.find((c: any[]) => c[0] === 'copilot');
    expect(copilotCall).toBeDefined();

    // Approval routed to deploy
    const ctx = loadContext(tmpDir);
    const states = ctx.stateHistory.map((e) => e.state);
    expect(states).toEqual(['analyze', 'deploy']);
  });
});
