import {Presenter} from '../../src/presenter';
import {StateDef} from '../../src/types';

function makeStateDef(id: string, type: string, extra?: Record<string, any>): StateDef {
  return { id, config: { type, ...extra } as any, transitions: [] };
}

describe('Presenter.render', () => {
  let logs: string[] = [];
  const originalLog = console.log;

  beforeEach(() => {
    logs = [];
    console.log = (msg?: any) => logs.push(String(msg));
  });

  afterEach(() => {
    console.log = originalLog;
  });

  test('renders boxed header for agent state with learnings applied', () => {
    const p = new Presenter();
    p.appendStateEnter(makeStateDef('coding', 'agent', { agent: 'a' }), 1, 3, '2026-03-18T10:32:00Z', true);
    p.render();

    const combined = logs.join('\n');
    expect(combined).toContain('🤖 #3 CODING');
    expect(combined).toContain('⏱️ Entered: 2026-03-18T10:32:00Z.');
    expect(combined).toContain('🔁 Visit: 1');
    expect(combined).toContain('✅ Learnings applied');
  });

  test('renders boxed header for engine state with no learnings', () => {
    const p = new Presenter();
    p.appendStateEnter(makeStateDef('done', 'engine'), 1, 1, '2026-03-19T12:00:00Z');
    p.render();

    const combined = logs.join('\n');
    expect(combined).toContain('⚙️ #1 DONE');
    expect(combined).toContain('⏱️ Entered: 2026-03-19T12:00:00Z.');
    expect(combined).toContain('🔁 Visit: 1');
    expect(combined).toContain('No earlier run output');
  });

  test('renders learningNote when provided', () => {
    const p = new Presenter();
    p.appendStateEnter(makeStateDef('analyze', 'script'), 2, 4, '2026-03-20T08:00:00Z', false, true);
    p.render();

    const combined = logs.join('\n');
    expect(combined).toContain('📜 #4 ANALYZE');
    expect(combined).toContain('Earlier output applied');
  });

  test('produces no output when entry is null', () => {
    const p = new Presenter();
    p.render();
    expect(logs).toHaveLength(0);
  });
});
