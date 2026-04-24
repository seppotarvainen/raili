import { RoutingManager } from '../../../src/runner/routingManager';
import { StateMachine, StateDef, WorkflowContext } from '../../../src/types';

describe('RoutingManager', () => {
  const cwd = '/tmp';
  const deps = {
    cwd,
    runNotify: jest.fn().mockResolvedValue(undefined),
    clearAgentOutputs: jest.fn(),
  } as any;

  test('evaluateSkip returns target when skip configured', () => {
    const mgr = new RoutingManager(deps);
    const sm: StateMachine = { initial: 'a', states: { a: { id: 'a', config: { type: 'engine' }, transitions: ['b'] }, b: { id: 'b', config: { type: 'engine' }, transitions: [] } } };
    const sd: StateDef = { id: 'a', config: { type: 'engine', skip: 'b' }, transitions: ['b'] } as any;
    const t = mgr.evaluateSkip('a', sd, sm);
    expect(t).toBe('b');
  });

  test('evaluateSkip throws when target missing', () => {
    const mgr = new RoutingManager(deps);
    const sm: StateMachine = { initial: 'a', states: { a: { id: 'a', config: { type: 'engine' }, transitions: [] } } };
    const sd: StateDef = { id: 'a', config: { type: 'engine', skip: 'ghost' }, transitions: [] } as any;
    expect(() => mgr.evaluateSkip('a', sd, sm)).toThrow(/skip target 'ghost' not found/);
  });

  test('routeToNext uses continue when present', () => {
    const mgr = new RoutingManager(deps);
    const sm: StateMachine = { initial: 'a', states: { a: { id: 'a', config: { type: 'engine' }, transitions: ['b'] }, b: { id: 'b', config: { type: 'engine' }, transitions: [] } } };
    const sd: StateDef = { id: 'a', config: { type: 'engine', continue: 'b' }, transitions: ['b'] } as any;
    const next = mgr.routeToNext('a', sd, 'PASSED', sm);
    expect(next).toBe('b');
  });

  test('routeToNext throws for unmapped outcome', () => {
    const mgr = new RoutingManager(deps);
    const sm: StateMachine = { initial: 'a', states: { a: { id: 'a', config: { type: 'engine' }, transitions: ['done'] }, done: { id: 'done', config: { type: 'engine' }, transitions: [] } } };
    const sd: StateDef = { id: 'a', config: { type: 'engine', transitions: { ok: 'done' } as any }, transitions: ['done'] } as any;
    expect(() => mgr.routeToNext('a', sd, 'BAD', sm)).toThrow(/has no matching transition/);
  });

  test('routeError returns false when no error state', async () => {
    const mgr = new RoutingManager(deps);
    const sm: StateMachine = { initial: 'a', states: { a: { id: 'a', config: { type: 'engine' }, transitions: [] } } };
    const ctx: WorkflowContext = { stateHistory: [] };
    const handled = await mgr.routeError(new Error('boom'), sm, ctx);
    expect(handled).toBe(false);
  });

  test('routeError handles error state and invokes deps', async () => {
    const mgr = new RoutingManager(deps);
    const sm: StateMachine = {
      initial: 'a',
      error: 'err',
      states: {
        a: { id: 'a', config: { type: 'engine' }, transitions: [] },
        err: { id: 'err', config: { type: 'engine', notify: 'echo notify', reset_outputs: ['x'] as any }, transitions: [] },
      },
    };
    const ctx: WorkflowContext = { stateHistory: [] };
    const handled = await mgr.routeError(new Error('boom'), sm, ctx);
    expect(handled).toBe(true);
    expect(deps.clearAgentOutputs).toHaveBeenCalled();
    expect(deps.runNotify).toHaveBeenCalled();
  });
});
