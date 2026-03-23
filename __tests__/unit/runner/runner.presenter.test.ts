import {Presenter} from '../../../src/presenter';
import {StateDef} from '../../../src/types';

function makeStateDef(id: string, type: string, extra?: Record<string, any>): StateDef {
  return { id, config: { type, ...extra } as any, transitions: [] };
}

const TS = '2026-03-18T10:32:00Z';

describe('Presenter.appendStateEnter', () => {
  test('stores stateName as uppercased state id', () => {
    const p = new Presenter();
    p.appendStateEnter(makeStateDef('start', 'agent', { agent: 'a' }), 1, 1, TS);
    expect(p.entry?.stateName).toBe('START');
  });

  test('stores type from stateDef config', () => {
    const p = new Presenter();
    p.appendStateEnter(makeStateDef('start', 'agent'), 1, 1, TS);
    expect(p.entry?.type).toBe('agent');
  });

  test('defaults type to engine when config.type is missing', () => {
    const p = new Presenter();
    p.appendStateEnter({ id: 'x', config: {} as any, transitions: [] }, 1, 1, TS);
    expect(p.entry?.type).toBe('engine');
  });

  test('stores visit count', () => {
    const p = new Presenter();
    p.appendStateEnter(makeStateDef('done', 'engine'), 3, 5, TS);
    expect(p.entry?.visit).toBe(3);
  });

  test('stores history count', () => {
    const p = new Presenter();
    p.appendStateEnter(makeStateDef('done', 'engine'), 1, 5, TS);
    expect(p.entry?.count).toBe(5);
  });

  test('stores enteredAt', () => {
    const p = new Presenter();
    p.appendStateEnter(makeStateDef('start', 'agent'), 1, 1, TS);
    expect(p.entry?.enteredAt).toBe(TS);
  });

  test('entry is null before any call', () => {
    const p = new Presenter();
    expect(p.entry).toBeNull();
  });

  test('sets applyFrame to true', () => {
    const p = new Presenter();
    p.appendStateEnter(makeStateDef('start', 'agent'), 1, 1, TS);
    expect(p.entry?.applyFrame).toBe(true);
  });

  test('builds lines with emoji, stateName, enteredAt and visit', () => {
    const p = new Presenter();
    p.appendStateEnter(makeStateDef('start', 'agent'), 1, 1, TS);
    expect(p.entry?.lines.entries[0].content).toContain('🤖');
    expect(p.entry?.lines.entries[0].content).toContain('#1 START');
    expect(p.entry?.lines.entries[1].content).toContain(TS);
    expect(p.entry?.lines.entries[2].content).toContain('Visit: 1');
  });

  test('builds lines with learningsApplied', () => {
    const p = new Presenter();
    p.appendStateEnter(makeStateDef('start', 'agent'), 1, 1, TS, true);
    expect(p.entry?.lines.entries[3].content).toContain('✅ Learnings applied');
  });

  test('builds lines with outputsApplied=true', () => {
    const p = new Presenter();
    p.appendStateEnter(makeStateDef('start', 'agent'), 1, 1, TS, false, true);
    expect(p.entry?.lines.entries[3].content).toContain('Earlier output applied');
  });

  test('builds lines with fallback no earlier run output', () => {
    const p = new Presenter();
    p.appendStateEnter(makeStateDef('start', 'agent'), 1, 1, TS);
    expect(p.entry?.lines.entries[3].content).toContain('No earlier run output');
  });
});

describe('Presenter.render', () => {
  test('does not throw when entry is set', () => {
    const p = new Presenter();
    p.appendStateEnter(makeStateDef('start', 'agent'), 1, 1, TS);
    expect(() => p.render()).not.toThrow();
  });

  test('does nothing when entry is null', () => {
    const p = new Presenter();
    expect(() => p.render()).not.toThrow();
  });
});
