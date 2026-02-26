import fs from 'fs';
import path from 'path';
import os from 'os';
import { loadWorkflowConfig, buildStateMachine, validateStateMachine } from '../src/workflowLoader';

describe('workflowLoader', () => {
  let tmpdir: string;

  beforeEach(() => {
    tmpdir = fs.mkdtempSync(path.join(os.tmpdir(), 'raili-wf-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpdir, { recursive: true, force: true });
  });

  describe('loadWorkflowConfig', () => {
    test('throws if workflow.yaml does not exist', () => {
        expect(() => loadWorkflowConfig(tmpdir)).toThrow('Workflow file not found');
    });

    test('throws if workflow.yaml is invalid', () => {
      const railiDir = path.join(tmpdir, '.raili');
      fs.mkdirSync(railiDir);
      fs.writeFileSync(path.join(railiDir, 'workflow.yaml'), 'not: [valid');

      expect(() => loadWorkflowConfig(tmpdir)).toThrow();
    });

    test('throws if initial state is missing', () => {
      const railiDir = path.join(tmpdir, '.raili');
      fs.mkdirSync(railiDir);
      fs.writeFileSync(path.join(railiDir, 'workflow.yaml'), 'states:\n  init:\n    type: engine\n');

      expect(() => loadWorkflowConfig(tmpdir)).toThrow('must define "initial" state');
    });

    test('loads valid workflow config', () => {
      const railiDir = path.join(tmpdir, '.raili');
      fs.mkdirSync(railiDir);
      const workflow = [
        'initial: init',
        'states:',
        '  init:',
        '    type: engine',
        '  done:',
        '    type: engine',
      ].join('\n');
      fs.writeFileSync(path.join(railiDir, 'workflow.yaml'), workflow);

      const config = loadWorkflowConfig(tmpdir);
      expect(config.initial).toBe('init');
      expect(config.states.init.type).toBe('engine');
    });

    test('merges states from included sub-workflow', () => {
      const railiDir = path.join(tmpdir, '.raili');
      fs.mkdirSync(railiDir);

      fs.writeFileSync(path.join(railiDir, 'workflow.yaml'), [
        'initial: init',
        'include:',
        '  - frontend.workflow.yaml',
        'states:',
        '  init:',
        '    type: engine',
        '    transitions:',
        '      go: implement-frontend',
      ].join('\n'));

      fs.writeFileSync(path.join(railiDir, 'frontend.workflow.yaml'), [
        'states:',
        '  implement-frontend:',
        '    type: agent',
        '    agent: frontend-coder.agent',
      ].join('\n'));

      const config = loadWorkflowConfig(tmpdir);
      expect(config.states['implement-frontend']).toBeDefined();
      expect(config.states['implement-frontend'].agent).toBe('frontend-coder.agent');
    });

    test('throws if sub-workflow defines initial', () => {
      const railiDir = path.join(tmpdir, '.raili');
      fs.mkdirSync(railiDir);

      fs.writeFileSync(path.join(railiDir, 'workflow.yaml'), [
        'initial: init',
        'include:',
        '  - sub.workflow.yaml',
        'states:',
        '  init:',
        '    type: engine',
      ].join('\n'));

      fs.writeFileSync(path.join(railiDir, 'sub.workflow.yaml'), [
        'initial: implement',
        'states:',
        '  implement:',
        '    type: agent',
        '    agent: coder.agent',
      ].join('\n'));

      expect(() => loadWorkflowConfig(tmpdir)).toThrow("Sub-workflow file must not define 'initial'");
    });

    test('throws on duplicate state names across included files', () => {
      const railiDir = path.join(tmpdir, '.raili');
      fs.mkdirSync(railiDir);

      fs.writeFileSync(path.join(railiDir, 'workflow.yaml'), [
        'initial: init',
        'include:',
        '  - sub.workflow.yaml',
        'states:',
        '  init:',
        '    type: engine',
      ].join('\n'));

      fs.writeFileSync(path.join(railiDir, 'sub.workflow.yaml'), [
        'states:',
        '  init:',
        '    type: agent',
        '    agent: coder.agent',
      ].join('\n'));

      expect(() => loadWorkflowConfig(tmpdir)).toThrow("Duplicate state 'init'");
    });

    test('throws if included file does not exist', () => {
      const railiDir = path.join(tmpdir, '.raili');
      fs.mkdirSync(railiDir);

      fs.writeFileSync(path.join(railiDir, 'workflow.yaml'), [
        'initial: init',
        'include:',
        '  - missing.workflow.yaml',
        'states:',
        '  init:',
        '    type: engine',
      ].join('\n'));

      expect(() => loadWorkflowConfig(tmpdir)).toThrow('Workflow file not found');
    });
  });

  describe('buildStateMachine', () => {
    test('builds state machine with transitions from on property', () => {
      const config = {
        initial: 'start',
        states: {
          start: {
            type: 'engine' as const,
            on: {
              PASSED: 'end',
            },
          },
          end: {
            type: 'engine' as const,
          },
        },
      };

      const machine = buildStateMachine(config);
      expect(machine.initial).toBe('start');
      expect(machine.states.start.transitions).toContain('end');
    });

    test('builds state machine with approval transitions', () => {
      const config = {
        initial: 'analyze',
        states: {
          analyze: {
            type: 'agent' as const,
            agent: 'analyzer',
            approval: {
              question: 'OK?',
              PASSED: 'plan',
              FAILED: 'analyze',
            },
          },
          plan: {
            type: 'agent' as const,
            agent: 'planner',
          },
        },
      };

      const machine = buildStateMachine(config);
      expect(machine.states.analyze.transitions).toContain('plan');
      expect(machine.states.analyze.transitions).toContain('analyze');
    });

    test('builds state machine with conditional transitions', () => {
      const config = {
        initial: 'verify',
        states: {
          verify: {
            type: 'agent' as const,
            agent: 'verifier',
            transitions: {
              tests_failed: 'execute',
              ready: 'done',
            },
          },
          execute: {
            type: 'agent' as const,
            agent: 'executor',
          },
          done: {
            type: 'engine' as const,
          },
        },
      };

      const machine = buildStateMachine(config);
      expect(machine.states.verify.transitions).toContain('execute');
      expect(machine.states.verify.transitions).toContain('done');
    });
  });

  describe('validateStateMachine', () => {
    test('throws if initial state does not exist', () => {
      const machine = {
        initial: 'ghost',
        states: {
          init: {
            id: 'init',
            config: { type: 'engine' as const },
            transitions: [],
          },
        },
      };

      expect(() => validateStateMachine(machine)).toThrow("initial state 'ghost' not defined");
    });

    test('throws if transition points to unknown state', () => {
      const machine = {
        initial: 'init',
        states: {
          init: {
            id: 'init',
            config: { type: 'engine' as const },
            transitions: ['ghost'],
          },
        },
      };

      expect(() => validateStateMachine(machine)).toThrow("transition to unknown state 'ghost'");
    });

    test('throws if agent type is missing agent property', () => {
      const machine = {
        initial: 'analyze',
        states: {
          analyze: {
            id: 'analyze',
            config: { type: 'agent' as const },
            transitions: [],
          },
        },
      };

      expect(() => validateStateMachine(machine)).toThrow("agent type requires 'agent' property");
    });

    test('throws if script type is missing script property', () => {
      const machine = {
        initial: 'test',
        states: {
          test: {
            id: 'test',
            config: { type: 'script' as const },
            transitions: [],
          },
        },
      };

      expect(() => validateStateMachine(machine)).toThrow("script type requires 'script' property");
    });

    test('throws if state has both on and transitions', () => {
      const machine = {
        initial: 'verify',
        states: {
          verify: {
            id: 'verify',
            config: {
              type: 'agent' as const,
              agent: 'verifier',
              on: { PASSED: 'done' },
              transitions: { tests_failed: 'done' },
            },
            transitions: ['done'],
          },
          done: {
            id: 'done',
            config: { type: 'engine' as const },
            transitions: [],
          },
        },
      };

      expect(() => validateStateMachine(machine)).toThrow(
        "cannot have both 'on' and 'transitions'"
      );
    });

    test('validates valid state machine', () => {
      const machine = {
        initial: 'init',
        states: {
          init: {
            id: 'init',
            config: { type: 'engine' as const },
            transitions: ['done'],
          },
          done: {
            id: 'done',
            config: { type: 'engine' as const },
            transitions: [],
          },
        },
      };

      expect(() => validateStateMachine(machine)).not.toThrow();
    });
  });
});

