import fs from 'fs';
import path from 'path';
import { initCommand } from '../../src/init';
import { runCommand } from '../../src/run';
import { loadContext } from '../../src/context';
import { formatHelp } from '../../src/cli/help';
import { formatDocs } from '../../src/cli/docs';
import { formatSchema } from '../../src/cli/schema';
import { loadVarsFile } from '../../src/cli';
import {
  createTmpWorkspace,
  cleanupTmpWorkspace,
  writeWorkflow,
  writeAgentRegistry,
  writeScriptRegistry,
  fakeChild,
  cleanupRailiEnvVars,
    // @ts-ignore
} from './testUtils';

jest.mock('child_process', () => ({ spawn: jest.fn() }));
const { spawn } = require('child_process');

let tmpDir: string;

beforeEach(() => {
  spawn.mockImplementation(() => fakeChild('', '', 0));
});

afterEach(() => {
  if (tmpDir && fs.existsSync(tmpDir)) {
    cleanupTmpWorkspace(tmpDir);
  }
  cleanupRailiEnvVars();
  spawn.mockReset();
});

// ---------------------------------------------------------------------------
// raili init
// ---------------------------------------------------------------------------
describe('raili init', () => {
  it('creates .raili/ directory with template files', async () => {
    // Use a fresh dir without .raili/ (createTmpWorkspace pre-creates it)
    tmpDir = createTmpWorkspace();
    // Remove the auto-created .raili so initCommand can create it
    fs.rmSync(path.join(tmpDir, '.raili'), { recursive: true });

    await initCommand(tmpDir);

    expect(fs.existsSync(path.join(tmpDir, '.raili'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, '.raili', 'workflow.yaml'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, '.raili', 'agent-registry.json'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, '.raili', 'script-registry.json'))).toBe(true);

    // workflow.yaml contains expected initial state
    const workflow = fs.readFileSync(path.join(tmpDir, '.raili', 'workflow.yaml'), 'utf8');
    expect(workflow).toContain('initial: init');
    expect(workflow).toContain('states:');
  });

  it('throws if .raili/ already exists', async () => {
    tmpDir = createTmpWorkspace(); // creates .raili/

    await expect(initCommand(tmpDir)).rejects.toThrow('.raili/ already exists');
  });
});

// ---------------------------------------------------------------------------
// raili run — clean run
// ---------------------------------------------------------------------------
describe('raili run — clean run', () => {
  it('runs a clean workflow from initial state', async () => {
    tmpDir = createTmpWorkspace();
    writeWorkflow(tmpDir, `
initial: start
states:
  start:
    type: engine
    on:
      PASSED: done
  done:
    type: engine
`);
    writeAgentRegistry(tmpDir, {});
    writeScriptRegistry(tmpDir, {});

    await runCommand(tmpDir, 'clean', {});

    const ctx = loadContext(tmpDir);
    expect(ctx.stateHistory.map((e) => e.state)).toEqual(['start', 'done']);
  });
});

// ---------------------------------------------------------------------------
// raili run — continue (resume from context)
// ---------------------------------------------------------------------------
describe('raili run — continue (resume)', () => {
  it('resumes workflow from last persisted state', async () => {
    tmpDir = createTmpWorkspace();
    writeWorkflow(tmpDir, `
initial: step_a
states:
  step_a:
    type: engine
    on:
      PASSED: step_b
  step_b:
    type: engine
    on:
      PASSED: step_c
  step_c:
    type: engine
`);
    writeAgentRegistry(tmpDir, {});
    writeScriptRegistry(tmpDir, {});

    // First run stops at step_b (we'll run clean, which goes all the way through).
    // To test resume, we manually write context stopping at step_b.
    fs.writeFileSync(
      path.join(tmpDir, '.raili', 'context.json'),
      JSON.stringify({
        stateHistory: [
          { state: 'step_a', enteredAt: '2026-01-01T00:00:00Z' },
          { state: 'step_b', enteredAt: '2026-01-01T00:01:00Z' },
        ],
      }),
      'utf8',
    );

    await runCommand(tmpDir, 'continue', {});

    const ctx = loadContext(tmpDir);
    const states = ctx.stateHistory.map((e) => e.state);
    // Resume from step_b → transitions to step_c
    expect(states).toContain('step_b');
    expect(states).toContain('step_c');
    expect(states[states.length - 1]).toBe('step_c');
  });
});

// ---------------------------------------------------------------------------
// raili run — fail-fast: missing .raili/
// ---------------------------------------------------------------------------
describe('raili run — fail-fast validation', () => {
  it('throws when .raili/ directory is missing', async () => {
    tmpDir = createTmpWorkspace();
    // Remove the .raili dir
    fs.rmSync(path.join(tmpDir, '.raili'), { recursive: true });

    await expect(runCommand(tmpDir, 'clean', {})).rejects.toThrow('.raili/ directory not found');
  });

  it('throws when agent-registry.json is missing', async () => {
    tmpDir = createTmpWorkspace();
    writeWorkflow(tmpDir, `
initial: start
states:
  start:
    type: engine
`);
    writeScriptRegistry(tmpDir, {});
    // No agent-registry.json

    await expect(runCommand(tmpDir, 'clean', {})).rejects.toThrow('agent-registry.json not found');
  });

  it('throws when script-registry.json is missing', async () => {
    tmpDir = createTmpWorkspace();
    writeWorkflow(tmpDir, `
initial: start
states:
  start:
    type: engine
`);
    writeAgentRegistry(tmpDir, {});
    // No script-registry.json

    await expect(runCommand(tmpDir, 'clean', {})).rejects.toThrow('script-registry.json not found');
  });
});

// ---------------------------------------------------------------------------
// raili run — vars from vars.yaml
// ---------------------------------------------------------------------------
describe('raili run — vars.yaml loading', () => {
  it('loads declared vars from vars.yaml', () => {
    tmpDir = createTmpWorkspace();
    writeWorkflow(tmpDir, `
initial: start
inputs:
  - ticket_id
  - branch
states:
  start:
    type: engine
`);
    // Write vars.yaml
    fs.writeFileSync(
      path.join(tmpDir, '.raili', 'vars.yaml'),
      'ticket_id: PROJ-999\nbranch: main\nextra_var: should_be_ignored\n',
      'utf8',
    );

    const vars = loadVarsFile(tmpDir, ['ticket_id', 'branch']);
    expect(vars).toEqual({ ticket_id: 'PROJ-999', branch: 'main' });
    // extra_var not declared in inputs, so not loaded
    expect(vars).not.toHaveProperty('extra_var');
  });
});

// ---------------------------------------------------------------------------
// raili help
// ---------------------------------------------------------------------------
describe('raili help', () => {
  it('returns global usage when called without args', () => {
    const output = formatHelp();
    expect(output).toContain('Usage: raili');
  });

  it('returns command help for "run"', () => {
    const output = formatHelp('run');
    expect(output).toContain('raili run');
    expect(output).toContain('--clean');
  });

  it('returns command help for "init"', () => {
    const output = formatHelp('init');
    expect(output).toContain('raili init');
  });

  it('returns topic help for "routing"', () => {
    const output = formatHelp(undefined, 'routing');
    expect(output.length).toBeGreaterThan(10);
  });

  it('returns error for unknown topic', () => {
    const output = formatHelp(undefined, 'nonexistent_topic');
    expect(output).toContain('Unknown topic');
  });
});

// ---------------------------------------------------------------------------
// raili docs
// ---------------------------------------------------------------------------
describe('raili docs', () => {
  it('returns documentation index when called without section', () => {
    const output = formatDocs();
    expect(output).toContain('RAILI DOCUMENTATION');
    expect(output).toContain('Available sections');
  });

  it('returns section content for "states"', () => {
    const output = formatDocs('states');
    expect(output).toContain('agent');
    expect(output).toContain('script');
    expect(output).toContain('command');
    expect(output).toContain('engine');
  });

  it('returns section content for "variables"', () => {
    const output = formatDocs('variables');
    expect(output).toContain('RAILI_VAR');
    expect(output).toContain('inputs');
  });

  it('returns usage docs for "init"', () => {
    const output = formatDocs('init');
    expect(output).toContain('raili init');
  });

  it('returns error for unknown section', () => {
    const output = formatDocs('unknown_section');
    expect(output).toContain('Unknown section');
  });
});

// ---------------------------------------------------------------------------
// raili schema
// ---------------------------------------------------------------------------
describe('raili schema', () => {
  it('returns a non-empty schema output', () => {
    const output = formatSchema();
    expect(output.length).toBeGreaterThan(50);
    // Should include field names from the schema
    expect(output).toContain('type');
  });
});

