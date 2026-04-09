import { buildGraph } from '../../../src/cli/graphBuilder';
import { WorkflowConfig } from '../../../src/types';

describe('buildGraph', () => {
  test('creates nodes for each state', () => {
    const cfg: WorkflowConfig = {
      initial: 'a',
      states: {
        a: { type: 'engine', transitions: { next: 'b' } },
        b: { type: 'engine' },
      },
    };

    const g = buildGraph(cfg);
    const ids = g.nodes.map((n) => n.id).sort();
    expect(ids).toEqual(['a', 'b']);
  });

  test('extracts edges from transitions and on and marks default', () => {
    const cfg: WorkflowConfig = {
      initial: 's',
      states: {
        s: { type: 'agent', transitions: { approve: 'ok', default: 'fallback' } },
        t: { type: 'script', on: { PASSED: 'p', FAILED: 'f' } },
        ok: { type: 'engine' },
        fallback: { type: 'engine' },
        p: { type: 'engine' },
        f: { type: 'engine' },
      },
    };

    const g = buildGraph(cfg);
    const repr = g.edges.map((e) => `${e.from}->${e.outcome}->${e.to}`);
    expect(repr).toEqual(expect.arrayContaining(['s->approve->ok', 's->default->fallback', 't->PASSED->p', 't->FAILED->f']));

    const defaultEdge = g.edges.find((e) => e.from === 's' && e.outcome === 'default');
    expect(defaultEdge).toBeDefined();
    expect(defaultEdge?.isDefault).toBe(true);
  });

  test('detects terminal states (no routing)', () => {
    const cfg: WorkflowConfig = {
      initial: 'start',
      states: {
        start: { type: 'engine', transitions: { next: 'end' } },
        end: { type: 'engine' },
        lonely: { type: 'script' },
      },
    };

    const g = buildGraph(cfg);
    expect(g.terminals.sort()).toEqual(['end', 'lonely'].sort());
  });

  test('throws when transition target is undefined', () => {
    const cfg: WorkflowConfig = {
      initial: 'a',
      states: {
        a: { type: 'engine', transitions: { toMissing: 'missing' } },
      },
    };

    expect(() => buildGraph(cfg)).toThrow(/Undefined transition targets: missing/);
  });
});
