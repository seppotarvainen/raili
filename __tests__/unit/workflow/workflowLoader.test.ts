import fs from 'fs';
import path from 'path';
import os from 'os';
import {buildStateMachine, loadWorkflowConfig, validateStateMachine} from '../../../src/workflow/workflowLoader';

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
      const railiDir = path.join(tmpdir, '.raili');
      fs.mkdirSync(path.join(railiDir, 'main'), { recursive: true });
      expect(() => loadWorkflowConfig(tmpdir)).toThrow('Workflow file not found');
    });

    test('throws if workflow.yaml is invalid', () => {
      const railiDir = path.join(tmpdir, '.raili');
      fs.mkdirSync(path.join(railiDir, 'main'), { recursive: true });
      fs.writeFileSync(path.join(railiDir, 'main', 'workflow.yaml'), 'not: [valid');

      expect(() => loadWorkflowConfig(tmpdir)).toThrow();
    });

    test('throws if initial state is missing', () => {
      const railiDir = path.join(tmpdir, '.raili');
      fs.mkdirSync(path.join(railiDir, 'main'), { recursive: true });
      fs.writeFileSync(path.join(railiDir, 'main', 'workflow.yaml'), 'states:\n  init:\n    type: engine\n');

      expect(() => loadWorkflowConfig(tmpdir)).toThrow('Required field \'initial\' is missing');
    });

    test('loads valid workflow config', () => {
      const railiDir = path.join(tmpdir, '.raili');
      fs.mkdirSync(path.join(railiDir, 'main'), { recursive: true });
      const workflow = [
        'initial: init',
        'states:',
        '  init:',
        '    type: engine',
        '  done:',
        '    type: engine',
      ].join('\n');
      fs.writeFileSync(path.join(railiDir, 'main', 'workflow.yaml'), workflow);

      const config = loadWorkflowConfig(tmpdir);
      expect(config.initial).toBe('init');
      expect(config.states.init.type).toBe('engine');
    });

    test('parses inputs declared as objects', () => {
      const railiDir = path.join(tmpdir, '.raili');
      fs.mkdirSync(path.join(railiDir, 'main'), { recursive: true });
      const workflow = [
        'initial: init',
        'inputs:',
        '  - name: ticket_id',
        "    description: 'The ticket id'",
        '  - name: branch',
        "    description: 'Git branch name'",
        'states:',
        '  init:',
        '    type: engine',
      ].join('\n');
      fs.writeFileSync(path.join(railiDir, 'main', 'workflow.yaml'), workflow);

      const config = loadWorkflowConfig(tmpdir);
      expect(config.inputs).toBeDefined();
      // normalized to objects
      expect(Array.isArray(config.inputs)).toBe(true);
      expect((config.inputs as any[])[0].name).toBe('ticket_id');
      expect((config.inputs as any[])[0].description).toBe('The ticket id');
      // log flag defaults to false when omitted
      expect((config.inputs as any[])[0].log).toBe(false);
      expect((config.inputs as any[])[1].name).toBe('branch');
      expect((config.inputs as any[])[1].description).toBe('Git branch name');
      expect((config.inputs as any[])[1].log).toBe(false);
    });

    test('parses inputs declared as strings (shorthand)', () => {
      const railiDir = path.join(tmpdir, '.raili');
      fs.mkdirSync(path.join(railiDir, 'main'), { recursive: true });
      const workflow = [
        'initial: init',
        'inputs:',
        '  - ticket_id',
        '  - branch',
        'states:',
        '  init:',
        '    type: engine',
      ].join('\n');
      fs.writeFileSync(path.join(railiDir, 'main', 'workflow.yaml'), workflow);

      const config = loadWorkflowConfig(tmpdir);
      expect(config.inputs).toBeDefined();
      expect(Array.isArray(config.inputs)).toBe(true);
      expect((config.inputs as any[])[0].name).toBe('ticket_id');
      expect((config.inputs as any[])[0].description).toBeUndefined();
      // shorthand inputs default log to false
      expect((config.inputs as any[])[0].log).toBe(false);
      expect((config.inputs as any[])[1].name).toBe('branch');
      expect((config.inputs as any[])[1].description).toBeUndefined();
      expect((config.inputs as any[])[1].log).toBe(false);
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

    test('throws for command state missing command property', () => {
      const machine: any = {
        initial: 'start',
        states: {
          start: { id: 'start', config: { type: 'command' }, transitions: [] },
        },
      };
      expect(() => validateStateMachine(machine)).toThrow(/command type requires/i);
    });

    test('throws for group state missing group property', () => {
      const machine: any = {
        initial: 'start',
        states: {
          start: { id: 'start', config: { type: 'group' }, transitions: [] },
        },
      };
      expect(() => validateStateMachine(machine)).toThrow(/group type requires/i);
    });

    test('throws when learn_from is not an array', () => {
      const machine: any = {
        initial: 'start',
        states: {
          start: { id: 'start', config: { type: 'engine', learn_from: 'bad' }, transitions: [] },
        },
      };
      expect(() => validateStateMachine(machine)).toThrow(/learn_from must be an array/i);
    });

    test('throws when learn_from entry is not an object', () => {
      const machine: any = {
        initial: 'start',
        states: {
          start: { id: 'start', config: { type: 'engine', learn_from: ['string-entry'] }, transitions: [] },
        },
      };
      expect(() => validateStateMachine(machine)).toThrow(/learn_from entries must be objects/i);
    });

    test('throws when learn_from entry has invalid key', () => {
      const machine: any = {
        initial: 'start',
        states: {
          start: { id: 'start', config: { type: 'engine', learn_from: [{ bad: 'x' }] }, transitions: [] },
        },
      };
      expect(() => validateStateMachine(machine)).toThrow(/learn_from entries must be of form/i);
    });

    test('throws when learn_from output references unknown state', () => {
      const machine: any = {
        initial: 'start',
        states: {
          start: {
            id: 'start',
            config: { type: 'engine', learn_from: [{ output: 'nonexistent' }] },
            transitions: [],
          },
        },
      };
      expect(() => validateStateMachine(machine)).toThrow(/unknown state 'nonexistent'/i);
    });

    test('throws when learn_from output state has no output.store', () => {
      const machine: any = {
        initial: 'start',
        states: {
          start: {
            id: 'start',
            config: { type: 'engine', learn_from: [{ output: 'prev' }] },
            transitions: ['prev'],
          },
          prev: {
            id: 'prev',
            config: { type: 'agent', agent: 'a' }, // no output.store
            transitions: [],
          },
        },
      };
      expect(() => validateStateMachine(machine)).toThrow(/output.store: true/i);
    });

    test('throws when declared error state is not in states', () => {
      const machine: any = {
        initial: 'start',
        error: 'missing_error',
        states: {
          start: { id: 'start', config: { type: 'engine' }, transitions: [] },
        },
      };
      expect(() => validateStateMachine(machine)).toThrow(/error state.*not found/i);
    });

    test('throws when error state is not terminal', () => {
      const machine: any = {
        initial: 'start',
        error: 'err',
        states: {
          start: { id: 'start', config: { type: 'engine' }, transitions: ['err'] },
          err:   { id: 'err',   config: { type: 'engine' }, transitions: ['start'] },
        },
      };
      expect(() => validateStateMachine(machine)).toThrow(/error state.*must be terminal/i);
    });
  });

  // ── buildStateMachine config.error and max_visits.continue ───────────────

  describe('buildStateMachine advanced paths', () => {
    function writeWf(dir: string, yaml: string) {
      const p = path.join(dir, '.raili', 'main');
      fs.mkdirSync(p, { recursive: true });
      fs.writeFileSync(path.join(p, 'workflow.yaml'), yaml);
    }

    test('sets machine.error when workflow declares error state', () => {
      writeWf(tmpdir, [
        'initial: start',
        'error: err',
        'states:',
        '  start:',
        '    type: engine',
        '    on:',
        '      PASSED: done',
        '      FAILED: err',
        '  done:',
        '    type: engine',
        '  err:',
        '    type: engine',
      ].join('\n'));
      const cfg = loadWorkflowConfig(tmpdir);
      const machine = buildStateMachine(cfg);
      expect(machine.error).toBe('err');
    });

    test('includes max_visits continue target in transitions', () => {
      writeWf(tmpdir, [
        'initial: start',
        'states:',
        '  start:',
        '    type: engine',
        '    max_visits:',
        '      count: 3',
        '      continue: fallback',
        '    on:',
        '      PASSED: done',
        '      FAILED: done',
        '  done:',
        '    type: engine',
        '  fallback:',
        '    type: engine',
      ].join('\n'));
      const cfg = loadWorkflowConfig(tmpdir);
      const machine = buildStateMachine(cfg);
      expect(machine.states['start'].transitions).toContain('fallback');
    });
  });

  // ── inputs validation ─────────────────────────────────────────────────────

  describe('loadWorkflowConfig inputs validation', () => {
    function writeWf(dir: string, yaml: string) {
      const p = path.join(dir, '.raili', 'main');
      fs.mkdirSync(p, { recursive: true });
      fs.writeFileSync(path.join(p, 'workflow.yaml'), yaml);
    }

    test('throws when inputs is not an array', () => {
      writeWf(tmpdir, 'initial: start\ninputs: "not-an-array"\nstates:\n  start:\n    type: engine\n');
      expect(() => loadWorkflowConfig(tmpdir)).toThrow();
    });
  });
});

