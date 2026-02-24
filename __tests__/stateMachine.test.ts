import { FIXED_STATE_MACHINE, validateStateMachine } from '../src/stateMachine';

describe('FIXED_STATE_MACHINE', () => {
  test('validates successfully', () => {
    expect(() => validateStateMachine(FIXED_STATE_MACHINE)).not.toThrow();
  });

  test('happy path transitions are allowed', () => {
    const m = FIXED_STATE_MACHINE;
    let cur = m.initial;
    // Walk the expected happy path: init -> analyze -> plan -> execute -> test -> verify -> archive -> done
    const path = ['analyze', 'plan', 'execute', 'test', 'verify', 'archive', 'done'];
    for (const next of path) {
      const def = m.states[cur];
      expect(def.transitions).toContain(next);
      cur = next as any;
    }
    expect(cur).toBe('done');
  });

  test('illegal transition detection (runtime check)', () => {
    const m = FIXED_STATE_MACHINE;
    const cur = 'init';
    const illegalNext = 'execute';
    expect(m.states[cur].transitions).not.toContain(illegalNext);
  });

  test('validator throws for machine with unknown transition', () => {
    const badMachine: any = {
      initial: 'init',
      states: {
        init: { id: 'init', transitions: ['ghost'] },
      },
    };
    expect(() => validateStateMachine(badMachine)).toThrow(/unknown state 'ghost'/i);
  });
});

