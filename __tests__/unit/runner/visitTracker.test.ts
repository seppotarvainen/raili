import { VisitTracker } from '../../../src/runner/visitTracker';

describe('VisitTracker', () => {
  test('increments and returns visit counts', () => {
    const vt = new VisitTracker(10);
    expect(vt.getVisitCount('a')).toBe(0);
    expect(vt.incrementVisit('a')).toBe(1);
    expect(vt.incrementVisit('a')).toBe(2);
    expect(vt.getVisitCount('a')).toBe(2);
    expect(vt.getVisitCount('b')).toBe(0);
  });

  test('recordStep counts only once per state and increments stepsExecuted', () => {
    const vt = new VisitTracker(10);
    expect(vt.getStepsExecuted()).toBe(0);
    expect(vt.recordStep('s1')).toBe(true);
    expect(vt.getStepsExecuted()).toBe(1);
    expect(vt.recordStep('s1')).toBe(false);
    expect(vt.getStepsExecuted()).toBe(1);
    expect(vt.recordStep('s2')).toBe(true);
    expect(vt.getStepsExecuted()).toBe(2);
  });

  test('resetVisits clears visit counts and allows recordStep again', () => {
    const vt = new VisitTracker(10);
    vt.incrementVisit('x');
    vt.incrementVisit('x');
    expect(vt.getVisitCount('x')).toBe(2);
    expect(vt.recordStep('x')).toBe(true);
    expect(vt.getStepsExecuted()).toBe(1);

    vt.resetVisits(['x']);
    expect(vt.getVisitCount('x')).toBe(0);

    // After reset, recordStep should count again
    expect(vt.recordStep('x')).toBe(true);
    expect(vt.getStepsExecuted()).toBe(2);
  });

  test('hasReachedLimit respects the configured maxSteps', () => {
    const vt = new VisitTracker(2);
    expect(vt.getStepsExecuted()).toBe(0);
    expect(vt.recordStep('a')).toBe(true); // stepsExecuted = 1
    expect(vt.recordStep('b')).toBe(true); // stepsExecuted = 2
    expect(vt.getStepsExecuted()).toBe(2);

    expect(vt.hasReachedLimit(0)).toBe(false);
    // asking to perform 1 more step would exceed max (2 + 1 > 2)
    expect(vt.hasReachedLimit(1)).toBe(true);
    // zero nextSteps doesn't exceed
    expect(vt.hasReachedLimit(0)).toBe(false);
  });

  test('constructor and hasReachedLimit validate inputs', () => {
    // invalid constructor arg
    expect(() => new VisitTracker(-1 as any)).toThrow();
    const vt = new VisitTracker(5);
    expect(() => vt.hasReachedLimit(-1 as any)).toThrow();
  });
});
