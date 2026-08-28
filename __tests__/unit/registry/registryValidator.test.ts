import path from 'path';
import { setupFakeFs } from '../infrastructure/fsFake.util';
import { getFileSystem } from '../../../src/infrastructure/fileSystemProvider';
import {
    validateAgentRegistry,
    validateScriptRegistry,
    validateWorkflowReferences
} from '../../../src/registry/registryValidator';
import {WorkflowConfig} from '../../../src/types';

const TMP = '/tmp';
let restoreFs: () => void;
beforeAll(() => { restoreFs = setupFakeFs(); });
afterAll(() => { restoreFs(); });

test('validates agent registry and files exist', () => {
  const raildir = path.join(TMP, '.raili');
  getFileSystem().mkdirSync(raildir);
  const agentFile = path.join(TMP, 'agents', 'a.md');
  getFileSystem().mkdirSync(path.dirname(agentFile), { recursive: true } as any);
  getFileSystem().writeFileSync(agentFile, 'content');
  const reg = { 'a.agent': { path: './agents/a.md' } };
  getFileSystem().writeFileSync(path.join(raildir, 'agent-registry.json'), JSON.stringify(reg));
  expect(() => validateAgentRegistry(TMP)).not.toThrow();
});

test('throws when script file missing', () => {
  const raildir = path.join(TMP, '.raili');
  getFileSystem().mkdirSync(raildir, { recursive: true } as any);
  const reg = { 's.part': { path: './scripts/missing.sh' } };
  getFileSystem().writeFileSync(path.join(raildir, 'script-registry.json'), JSON.stringify(reg));
  expect(() => validateScriptRegistry(TMP)).toThrow();
});

test('accepts a script whose runtime exists', () => {
  const raildir = path.join(TMP, '.raili');
  const scriptFile = path.join(TMP, 'scripts', 'runtime.js');
  getFileSystem().mkdirSync(raildir, { recursive: true } as any);
  getFileSystem().mkdirSync(path.dirname(scriptFile), { recursive: true } as any);
  getFileSystem().writeFileSync(scriptFile, 'console.log(1)');
  const runtimePath = path.join(TMP, 'bin', 'node');
  getFileSystem().mkdirSync(path.dirname(runtimePath), { recursive: true } as any);
  getFileSystem().writeFileSync(runtimePath, 'node');
  const reg = { runtime: { path: './scripts/runtime.js', runtime: runtimePath } };
  getFileSystem().writeFileSync(path.join(raildir, 'script-registry.json'), JSON.stringify(reg));
  expect(() => validateScriptRegistry(TMP)).not.toThrow();
});

test('throws when a script runtime is unavailable', () => {
  const raildir = path.join(TMP, '.raili');
  const scriptFile = path.join(TMP, 'scripts', 'missing-runtime.js');
  getFileSystem().mkdirSync(raildir, { recursive: true } as any);
  getFileSystem().mkdirSync(path.dirname(scriptFile), { recursive: true } as any);
  getFileSystem().writeFileSync(scriptFile, 'console.log(1)');
  const reg = { runtime: { path: './scripts/missing-runtime.js', runtime: 'raili-runtime-does-not-exist' } };
  getFileSystem().writeFileSync(path.join(raildir, 'script-registry.json'), JSON.stringify(reg));
  expect(() => validateScriptRegistry(TMP)).toThrow(
    "Script 'runtime' requires runtime 'raili-runtime-does-not-exist', but it was not found in PATH",
  );
});

describe('validateWorkflowReferences', () => {
  test('passes when all agents and scripts exist in registries', () => {
    const workflow: WorkflowConfig = {
      initial: 'analyze',
      states: {
        analyze: {
          type: 'agent',
          agent: 'analyzer.agent',
        },
        test: {
          type: 'script',
          script: 'test-runner',
        },
      },
    };

    const agents = {
      'analyzer.agent': { path: './agents/analyzer.md' },
    };

    const scripts = {
      'test-runner': { path: './scripts/test.sh' },
    };

    expect(() => validateWorkflowReferences(workflow, agents, scripts)).not.toThrow();
  });

  test('throws when agent referenced in workflow is not in registry', () => {
    const workflow: WorkflowConfig = {
      initial: 'analyze',
      states: {
        analyze: {
          type: 'agent',
          agent: 'missing.agent',
        },
      },
    };

    const agents = {};
    const scripts = {};

    expect(() => validateWorkflowReferences(workflow, agents, scripts)).toThrow(
      /State 'analyze' references agent 'missing.agent'/
    );
  });

  test('throws when script referenced in workflow is not in registry', () => {
    const workflow: WorkflowConfig = {
      initial: 'test',
      states: {
        test: {
          type: 'script',
          script: 'missing-script',
        },
      },
    };

    const agents = {};
    const scripts = {};

    expect(() => validateWorkflowReferences(workflow, agents, scripts)).toThrow(
      /State 'test' references script 'missing-script'/
    );
  });

  test('throws with comprehensive error for multiple missing references', () => {
    const workflow: WorkflowConfig = {
      initial: 'init',
      states: {
        analyze: {
          type: 'agent',
          agent: 'missing-analyzer',
        },
        plan: {
          type: 'agent',
          agent: 'missing-planner',
        },
        test: {
          type: 'script',
          script: 'missing-test',
        },
      },
    };

    const agents = {};
    const scripts = {};

    expect(() => validateWorkflowReferences(workflow, agents, scripts)).toThrow(
      /Workflow validation failed/
    );
    expect(() => validateWorkflowReferences(workflow, agents, scripts)).toThrow(
      /Missing agent definitions/
    );
    expect(() => validateWorkflowReferences(workflow, agents, scripts)).toThrow(
      /Missing script definitions/
    );
  });

  test('ignores engine-type states without agent or script', () => {
    const workflow: WorkflowConfig = {
      initial: 'init',
      states: {
        init: {
          type: 'engine',
        },
        done: {
          type: 'engine',
        },
      },
    };

    const agents = {};
    const scripts = {};

    expect(() => validateWorkflowReferences(workflow, agents, scripts)).not.toThrow();
  });
});

// Additional tests for group state nesting validation
import { validateWorkflowNesting } from '../../../src/registry/registryValidator';

describe('validateWorkflowNesting', () => {
  let tmpDir: string;
  beforeEach(() => {
    // use fake fs for nested workflow file tests
    tmpDir = '/tmp/rvn';
    getFileSystem().mkdirSync(tmpDir, { recursive: true } as any);
  });
  afterEach(() => {
    try { getFileSystem().rmSync(tmpDir, { recursive: true } as any); } catch (e) { }
  });

  test('missing sub-workflow file throws', () => {
    const wf: WorkflowConfig = {
      initial: 'start',
      states: {
        start: { type: 'engine' },
        groupState: { type: 'group', group: './nope.yaml' },
      },
    };

    expect(() => validateWorkflowNesting(wf, tmpDir)).toThrow(/references missing sub-workflow/);
  });

  test('sub-workflow contains nested group -> throws', () => {
    const subPath = path.join(tmpDir, 'sub.yaml');
    const subYaml = `states:\n  inner:\n    type: group\n    group: ./nested.yaml\n`;
    getFileSystem().writeFileSync(subPath, subYaml, 'utf8');

    const wf: WorkflowConfig = {
      initial: 'start',
      states: {
        start: { type: 'engine' },
        groupState: { type: 'group', group: './sub.yaml' },
      },
    };

    expect(() => validateWorkflowNesting(wf, tmpDir)).toThrow(/contains nested 'group' state 'inner'/);
  });

  test('main workflow references inner state -> throws', () => {
    const subPath = path.join(tmpDir, 'sub.yaml');
    const subYaml = `states:\n  a:\n    type: engine\n  b:\n    type: engine\n    out: true\n`;
    getFileSystem().writeFileSync(subPath, subYaml, 'utf8');

    const wf: WorkflowConfig = {
      initial: 'start',
      states: {
        start: { type: 'engine', on: { PASSED: 'b' } as any },
        groupState: { type: 'group', group: './sub.yaml' },
      },
    };

    expect(() => validateWorkflowNesting(wf, tmpDir)).toThrow(/Main workflow references inner state 'b'/);
  });

  test('sub-workflow with no out:true -> throws', () => {
    const subPath = path.join(tmpDir, 'sub.yaml');
    const subYaml = `states:\n  a:\n    type: engine\n`;
    getFileSystem().writeFileSync(subPath, subYaml, 'utf8');

    const wf: WorkflowConfig = {
      initial: 'start',
      states: {
        start: { type: 'engine' },
        groupState: { type: 'group', group: './sub.yaml' },
      },
    };

    expect(() => validateWorkflowNesting(wf, tmpDir)).toThrow(/must declare at least one state with 'out: true'/);
  });

  test('valid group passes validation', () => {
    const subPath = path.join(tmpDir, 'sub.yaml');
    const subYaml = `states:\n  prepare:\n    type: agent\n  done:\n    type: engine\n    out: true\n`;
    getFileSystem().writeFileSync(subPath, subYaml, 'utf8');

    const wf: WorkflowConfig = {
      initial: 'start',
      states: {
        start: { type: 'engine', transitions: { proceed: 'groupState' } as any },
        groupState: { type: 'group', group: './sub.yaml' },
      },
    };

    expect(() => validateWorkflowNesting(wf, tmpDir)).not.toThrow();
  });
});

// ── stat.isFile() false branches ─────────────────────────────────────────────

test('throws when agent registry entry points to a directory not a file', () => {
  const raildir = path.join(TMP, '.raili');
  getFileSystem().mkdirSync(raildir, { recursive: true } as any);
  // Create a DIRECTORY where the agent file is expected
  const agentDir = path.join(TMP, 'agents', 'dir-agent');
  getFileSystem().mkdirSync(agentDir, { recursive: true } as any);
  const reg = { 'dir.agent': { path: './agents/dir-agent' } };
  getFileSystem().writeFileSync(path.join(raildir, 'agent-registry.json'), JSON.stringify(reg));
  expect(() => validateAgentRegistry(TMP)).toThrow(/not a file/);
});

test('throws when script registry entry points to a directory not a file', () => {
  const raildir = path.join(TMP, '.raili');
  getFileSystem().mkdirSync(raildir, { recursive: true } as any);
  const scriptDir = path.join(TMP, 'scripts', 'dir-script');
  getFileSystem().mkdirSync(scriptDir, { recursive: true } as any);
  const reg = { 'dir.script': { path: './scripts/dir-script' } };
  getFileSystem().writeFileSync(path.join(raildir, 'script-registry.json'), JSON.stringify(reg));
  expect(() => validateScriptRegistry(TMP)).toThrow(/not a file/);
});

