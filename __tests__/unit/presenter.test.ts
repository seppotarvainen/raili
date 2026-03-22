import { Presenter } from '../../src/presenter';

describe('Presenter.renderEntry', () => {
  let logs: string[] = [];
  const originalLog = console.log;

  beforeEach(() => {
    logs = [];
    console.log = (msg?: any) => logs.push(String(msg));
  });

  afterEach(() => {
    console.log = originalLog;
  });

  test('renders boxed header for agent state', () => {
    const p = new Presenter();
    p.renderEntry({
      count: 3,
      stateName: 'CODING',
      type: 'agent',
      enteredAt: '2026-03-18T10:32:00Z',
      visit: 1,
      learningsApplied: true,
    });

    const combined = logs.join('\n');
    expect(combined).toContain('🤖 #3 CODING');
    expect(combined).toContain('⏱️ Entered: 2026-03-18T10:32:00Z.');
    expect(combined).toContain('🔁 Visit: 1');
    expect(combined).toContain('✅ Learnings applied');
  });

  test('renders boxed header for engine state with no learnings', () => {
    const p = new Presenter();
    p.renderEntry({
      count: 1,
      stateName: 'DONE',
      type: 'engine',
      enteredAt: '2026-03-19T12:00:00Z',
      visit: 1,
      learningsApplied: false,
    });

    const combined = logs.join('\n');
    expect(combined).toContain('⚙️ #1 DONE');
    expect(combined).toContain('⏱️ Entered: 2026-03-19T12:00:00Z.');
    expect(combined).toContain('🔁 Visit: 1');
    expect(combined).toContain('No earlier run output');
  });
});
