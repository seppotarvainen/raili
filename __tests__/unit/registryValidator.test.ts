import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  validateAgentRegistry,
  validateScriptRegistry,
  validateWorkflowReferences
} from '../../src/registry/registryValidator';
import {WorkflowConfig} from '../../src/types';

let TMP: string;
beforeAll(() => { TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'raili-regval-')); });
afterAll(() => { if (fs.existsSync(TMP)) fs.rmSync(TMP, { recursive: true }); });

test('validates agent registry and files exist', () => {
  const raildir = path.join(TMP, '.raili');
  fs.mkdirSync(raildir);
  const agentFile = path.join(TMP, 'agents', 'a.md');
  fs.mkdirSync(path.dirname(agentFile), { recursive: true });
  fs.writeFileSync(agentFile, 'content');
  const reg = { 'a.agent': { path: './agents/a.md' } };
  fs.writeFileSync(path.join(raildir, 'agent-registry.json'), JSON.stringify(reg));
  expect(() => validateAgentRegistry(TMP)).not.toThrow();
});

test('throws when script file missing', () => {
  const raildir = path.join(TMP, '.raili');
  fs.mkdirSync(raildir, { recursive: true });
  const reg = { 's.part': { path: './scripts/missing.sh' } };
  fs.writeFileSync(path.join(raildir, 'script-registry.json'), JSON.stringify(reg));
  expect(() => validateScriptRegistry(TMP)).toThrow();
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

