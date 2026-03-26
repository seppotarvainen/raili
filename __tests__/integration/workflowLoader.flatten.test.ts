import fs from 'fs';
import {
  createTmpWorkspace,
  cleanupTmpWorkspace,
  writeNamedWorkflow,
  writeWorkflow,
} from './testUtils';
import { loadWorkflowConfig } from '../../src/workflow/workflowLoader';
import * as path from 'path';

afterEach(() => {
  // nothing to cleanup here beyond tmp dirs created by each test
});

describe('workflowLoader flatten group states', () => {
  test('merges sub-workflow states and inputs into parent', () => {
    const tmp = createTmpWorkspace();
    try {
      const subYaml = `states:\n  prepare:\n    type: agent\n    agent: approver\n  approve:\n    type: engine\n    out: true\ninputs:\n  - sub_id\n`;
      writeNamedWorkflow(tmp, 'sub', subYaml);

      const mainYaml = `initial: start\nstates:\n  start:\n    type: engine\n    transitions:\n      next: do_group\n  do_group:\n    type: group\n    group: ../sub/workflow.yaml\n    on:\n      PASSED: finish\n      FAILED: rework\n  finish:\n    type: engine\n  rework:\n    type: engine\n`;
      writeWorkflow(tmp, mainYaml);

      const cfg = loadWorkflowConfig(tmp);
      expect(cfg.states['do_group.prepare']).toBeDefined();
      expect(cfg.states['do_group.approve']).toBeDefined();
      // inputs should contain sub_id
      const inputs = cfg.inputs || [];
      expect(inputs.some((i) => i.name === 'sub_id')).toBe(true);
    } finally {
      cleanupTmpWorkspace(tmp);
    }
  });

  test('duplicate input key throws', () => {
    const tmp = createTmpWorkspace();
    try {
      const subYaml = `states:\n  s1:\n    type: engine\n    out: true\ninputs:\n  - ticket_id\n`;
      writeNamedWorkflow(tmp, 'sub', subYaml);

      const mainYaml = `initial: start\ninputs:\n  - ticket_id\nstates:\n  start:\n    type: engine\n    transitions:\n      next: do_group\n  do_group:\n    type: group\n    group: ../sub/workflow.yaml\n    on:\n      PASSED: finish\n  finish:\n    type: engine\n`;
      writeWorkflow(tmp, mainYaml);

      expect(() => loadWorkflowConfig(tmp)).toThrow(/Duplicate input key 'ticket_id'/);
    } finally {
      cleanupTmpWorkspace(tmp);
    }
  });

  test('sub-workflow with nested group throws', () => {
    const tmp = createTmpWorkspace();
    try {
      const subYaml = `states:\n  nested:\n    type: group\n    group: ../other/workflow.yaml\n`;
      writeNamedWorkflow(tmp, 'sub', subYaml);

      const mainYaml = `initial: start\nstates:\n  start:\n    type: engine\n    transitions:\n      next: do_group\n  do_group:\n    type: group\n    group: ../sub/workflow.yaml\n    on:\n      PASSED: finish\n  finish:\n    type: engine\n`;
      writeWorkflow(tmp, mainYaml);

      expect(() => loadWorkflowConfig(tmp)).toThrow(/must not contain 'group'/);
    } finally {
      cleanupTmpWorkspace(tmp);
    }
  });

  test('sub-workflow missing out:true throws', () => {
    const tmp = createTmpWorkspace();
    try {
      const subYaml = `states:\n  a:\n    type: engine\n  b:\n    type: agent\n    agent: helper\n`;
      writeNamedWorkflow(tmp, 'sub', subYaml);

      const mainYaml = `initial: start\nstates:\n  start:\n    type: engine\n    transitions:\n      next: do_group\n  do_group:\n    type: group\n    group: ../sub/workflow.yaml\n    on:\n      PASSED: finish\n  finish:\n    type: engine\n`;
      writeWorkflow(tmp, mainYaml);

      expect(() => loadWorkflowConfig(tmp)).toThrow(/must declare at least one 'out: true'/);
    } finally {
      cleanupTmpWorkspace(tmp);
    }
  });
});
