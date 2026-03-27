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
  writeSubWorkflow,
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
// 1. Simple group routing
// ---------------------------------------------------------------------------
describe('group workflow - simple routing', () => {
  it('expands group and executes flattened states in order', async () => {
    writeWorkflow(
      tmpDir,
      `initial: setup
states:
  setup:
    type: engine
    on:
      PASSED: group_code
  group_code:
    type: group
    group: ./sub.yaml
    transitions:
      done: cleanup
  cleanup:
    type: engine
`,
    );

    // Sub-workflow: each non-terminal agent outputs the matching transition key as the last stdout line.
    // review is the out:true state and inherits transitions: {done: cleanup} from the parent group.
    writeSubWorkflow(
      tmpDir,
      'main',
      'sub.yaml',
      `states:
  analyze:
    type: agent
    agent: test_agent
    transitions:
      continue: code
  code:
    type: agent
    agent: test_agent
    transitions:
      done: review
  review:
    type: agent
    agent: test_agent
    out: true
`,
    );

    writeAgentRegistry(tmpDir, { test_agent: { path: './agents/test.agent.md' } });
    writeScriptRegistry(tmpDir, {});
    writeAgentFile(tmpDir, 'agents/test.agent.md', 'Agent instructions');

    // Each copilot call returns the expected transition key as the last stdout line.
    let copilotCallCount = 0;
    spawn.mockImplementation((cmd: string) => {
      if (cmd === 'copilot') {
        copilotCallCount++;
        if (copilotCallCount === 1) return fakeChild('analysis\ncontinue', '', 0); // analyze → 'continue'
        if (copilotCallCount === 2) return fakeChild('code output\ndone', '', 0); // code → 'done'
        return fakeChild('review output\ndone', '', 0); // review → 'done' (inherited from parent)
      }
      return fakeChild('', '', 0);
    });

    await runCommand(tmpDir, 'clean', {});

    const ctx = loadContext(tmpDir);
    const states = ctx.stateHistory.map((e) => e.state);
    // The proxy state 'group_code' appears in history (skip entry), then the flattened sub-states.
    expect(states).toEqual([
      'setup',
      'group_code',
      'group_code.analyze',
      'group_code.code',
      'group_code.review',
      'cleanup',
    ]);
  });
});

// ---------------------------------------------------------------------------
// 2. Group with approval
// ---------------------------------------------------------------------------
describe('group workflow - approval routing', () => {
  it('routes according to approval configured on parent group', async () => {
    writeWorkflow(
      tmpDir,
      `initial: start
states:
  start:
    type: engine
    on:
      PASSED: group_feature
  group_feature:
    type: group
    group: ./sub.yaml
    approval:
      question: "Approve sub-workflow?"
      PASSED: done
      FAILED: aborted
  done:
    type: engine
  aborted:
    type: engine
`,
    );

    // step2 is the out:true state and inherits the approval config from the parent group.
    writeSubWorkflow(
      tmpDir,
      'main',
      'sub.yaml',
      `states:
  step1:
    type: agent
    agent: test_agent
    transitions:
      next: step2
  step2:
    type: agent
    agent: test_agent
    out: true
`,
    );

    writeAgentRegistry(tmpDir, { test_agent: { path: './agents/test.agent.md' } });
    writeScriptRegistry(tmpDir, {});
    writeAgentFile(tmpDir, 'agents/test.agent.md', 'Agent instructions');

    let copilotCallCount = 0;
    spawn.mockImplementation((cmd: string) => {
      if (cmd === 'copilot') {
        copilotCallCount++;
        if (copilotCallCount === 1) return fakeChild('ok\nnext', '', 0); // step1 → 'next'
        return fakeChild('step2 output', '', 0); // step2: approval takes over routing
      }
      return fakeChild('', '', 0);
    });

    // Simulate user approval (also handles the skip confirmation for the proxy state).
    process.env.RAILI_MANUAL_CHOICE = 'PASSED';
    await runCommand(tmpDir, 'clean', {});

    const ctx = loadContext(tmpDir);
    const states = ctx.stateHistory.map((e) => e.state);
    expect(states[states.length - 1]).toBe('done');
  });
});

// ---------------------------------------------------------------------------
// 3. Group resumption
// ---------------------------------------------------------------------------
describe('group workflow - resumption', () => {
  it('resumes partial sub-workflow without re-executing completed states', async () => {
    writeWorkflow(
      tmpDir,
      `initial: start
states:
  start:
    type: engine
    on:
      PASSED: subgroup
  subgroup:
    type: group
    group: ./sub.yaml
    on:
      PASSED: end
  end:
    type: engine
`,
    );

    // All sub-states use on: routing (exit-code based), so the agent output content does not matter.
    // State 'c' is the out:true exit point and inherits on: {PASSED: end} from the parent group.
    writeSubWorkflow(
      tmpDir,
      'main',
      'sub.yaml',
      `states:
  a:
    type: agent
    agent: test_agent
    on:
      PASSED: b
  b:
    type: agent
    agent: test_agent
    on:
      PASSED: c
  c:
    type: agent
    agent: test_agent
    out: true
`,
    );

    writeAgentRegistry(tmpDir, { test_agent: { path: './agents/test.agent.md' } });
    writeScriptRegistry(tmpDir, {});
    writeAgentFile(tmpDir, 'agents/test.agent.md', 'Agent instructions');

    // First run: a and b succeed, c fails (non-zero exit).
    // c inherits on: {PASSED: end} — FAILED has no route → Runner throws.
    let callCount = 0;
    spawn.mockImplementation((cmd: string) => {
      if (cmd === 'copilot') {
        callCount++;
        if (callCount <= 2) return fakeChild('ok', '', 0);
        return fakeChild('', '', 1); // c fails
      }
      return fakeChild('', '', 0);
    });

    try {
      await runCommand(tmpDir, 'clean', {});
    } catch (_err) {
      // expected: 'FAILED' has no transition in on: {PASSED: end}
    }

    let ctx = loadContext(tmpDir);
    const statesAfterFirst = ctx.stateHistory.map((e) => e.state);
    // 'subgroup' proxy + a + b all recorded; 'c' is recorded in enterState before execution throws.
    expect(statesAfterFirst).toEqual([
      'start',
      'subgroup',
      'subgroup.a',
      'subgroup.b',
      'subgroup.c',
    ]);

    // Second run: c succeeds this time, routing continues to 'end'.
    spawn.mockReset();
    spawn.mockImplementation((cmd: string) => {
      if (cmd === 'copilot') return fakeChild('ok', '', 0);
      return fakeChild('', '', 0);
    });

    await runCommand(tmpDir, 'continue', {});

    ctx = loadContext(tmpDir);
    const finalStates = ctx.stateHistory.map((e) => e.state);
    // 'subgroup.c' was already in history; second run appends only 'end'.
    expect(finalStates).toEqual([
      'start',
      'subgroup',
      'subgroup.a',
      'subgroup.b',
      'subgroup.c',
      'end',
    ]);
  });
});

// ---------------------------------------------------------------------------
// 4. Shared variables
// ---------------------------------------------------------------------------
describe('group workflow - shared variables', () => {
  it('passes parent inputs into sub-workflow as env vars and interpolates prompts', async () => {
    writeWorkflow(
      tmpDir,
      `initial: start
inputs:
  - name: ticket_id
states:
  start:
    type: engine
    on:
      PASSED: mygroup
  mygroup:
    type: group
    group: ./sub.yaml
    on:
      PASSED: finish
  finish:
    type: engine
`,
    );

    writeSubWorkflow(
      tmpDir,
      'main',
      'sub.yaml',
      `states:
  check:
    type: agent
    agent: test_agent
    prompt: "Check ticket \${ticket_id}"
    out: true
`,
    );

    writeAgentRegistry(tmpDir, { test_agent: { path: './agents/test.agent.md' } });
    writeScriptRegistry(tmpDir, {});
    writeAgentFile(tmpDir, 'agents/test.agent.md', 'Agent instructions');

    let seenEnv: string | undefined;
    let seenPrompt: string | undefined;

    spawn.mockImplementation((cmd: string) => {
      if (cmd === 'copilot') {
        seenEnv = process.env.RAILI_VAR_TICKET_ID;
        const call = (spawn.mock.calls[spawn.mock.calls.length - 1] || []) as any[];
        const args = call[1] as string[] | undefined;
        if (args) {
          const idx = args.indexOf('--prompt');
          if (idx >= 0) seenPrompt = args[idx + 1];
        }
        return fakeChild('ok', '', 0);
      }
      return fakeChild('', '', 0);
    });

    await runCommand(tmpDir, 'clean', { ticket_id: 'T-123' });

    expect(seenEnv).toBe('T-123');
    expect(seenPrompt).toContain('Check ticket T-123');

    const ctx = loadContext(tmpDir);
    expect(ctx.stateHistory[ctx.stateHistory.length - 1].state).toBe('finish');
  });
});

// ---------------------------------------------------------------------------
// 5. Sub-workflow outputs
// ---------------------------------------------------------------------------
describe('group workflow - sub workflow outputs', () => {
  it('stores sub-workflow output under parent-prefixed filename', async () => {
    writeWorkflow(
      tmpDir,
      `initial: start
states:
  start:
    type: engine
    on:
      PASSED: groupx
  groupx:
    type: group
    group: ./sub.yaml
    on:
      PASSED: final
  final:
    type: engine
`,
    );

    writeSubWorkflow(
      tmpDir,
      'main',
      'sub.yaml',
      `states:
  produce:
    type: agent
    agent: test_agent
    output:
      store: true
    on:
      PASSED: consume
  consume:
    type: agent
    agent: test_agent
    out: true
`,
    );

    writeAgentRegistry(tmpDir, { test_agent: { path: './agents/test.agent.md' } });
    writeScriptRegistry(tmpDir, {});
    writeAgentFile(tmpDir, 'agents/test.agent.md', 'Agent instructions');

    spawn.mockImplementation((cmd: string) => {
      if (cmd === 'copilot') return fakeChild('stored output\nsome content', '', 0);
      return fakeChild('', '', 0);
    });

    await runCommand(tmpDir, 'clean', {});

    // Output is stored under the sub-state filename: produce.md (no parent prefix)
    const outPath = path.join(tmpDir, '.raili', 'main', 'outputs', 'produce.md');
    expect(fs.existsSync(outPath)).toBe(true);

    const content = fs.readFileSync(outPath, 'utf8');
    expect(content).toContain('stored output');

    const ctx = loadContext(tmpDir);
    const states = ctx.stateHistory.map((e) => e.state);
    expect(states).toContain('groupx.consume');
    expect(states[states.length - 1]).toBe('final');
  });
});
