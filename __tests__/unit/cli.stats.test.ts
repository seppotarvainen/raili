import { computeMetrics, computeComparison, RunEntry } from '../../src/cli/stats';

describe('computeMetrics', () => {
  test('returns zeros for empty runs', () => {
    const res = computeMetrics([]);
    expect(res.count).toBe(0);
    expect(res.avgLoops).toBe(0);
    expect(res.approvalFailRate).toBe(0);
    expect(res.avgStates).toBe(0);
    expect(res.avgDurationMs).toBe(0);
    expect(res.successRate).toBeNull();
  });

  test('computes averages and success rate', () => {
    const runs: RunEntry[] = [
      { loops: 2, approvalFailures: 1, stateCount: 5, durationMs: 1000, success: true },
      { loops: 0, approvalFailures: 0, stateCount: 3, durationMs: 500, success: false },
      { loops: 1, approvalFailures: 2, stateCount: 4, durationMs: 1500, success: true },
    ];
    const res = computeMetrics(runs);
    expect(res.count).toBe(3);
    expect(res.avgLoops).toBeCloseTo((2 + 0 + 1) / 3);
    expect(res.approvalFailRate).toBeCloseTo((1 + 0 + 2) / 3);
    expect(res.avgStates).toBeCloseTo((5 + 3 + 4) / 3);
    expect(res.avgDurationMs).toBeCloseTo((1000 + 500 + 1500) / 3);
    expect(res.successRate).toBeCloseTo(2 / 3);
  });
});

describe('computeComparison', () => {
  test('detects improving when lower-is-better decreases', () => {
    const prev = computeMetrics([
      { loops: 2, approvalFailures: 1, stateCount: 5, durationMs: 1000, success: true },
      { loops: 2, approvalFailures: 1, stateCount: 5, durationMs: 1000, success: true },
    ]);
    const curr = computeMetrics([{ loops: 1, approvalFailures: 0, stateCount: 4, durationMs: 800, success: true }]);
    const cmp = computeComparison(prev, curr as any);
    expect(cmp.avgLoops.direction).toBe('improving');
    expect(cmp.avgStates.direction).toBe('improving');
    expect(cmp.avgDurationMs.direction).toBe('improving');
    expect(cmp.approvalFailRate.direction).toBe('improving');
    expect(cmp.successRate.direction).toBe('no-change');
  });

  test('detects regressing when higher for lower-is-better metrics', () => {
    const prev = computeMetrics([{ loops: 1, approvalFailures: 0, stateCount: 3, durationMs: 500, success: true }]);
    const curr = computeMetrics([{ loops: 3, approvalFailures: 2, stateCount: 6, durationMs: 1500, success: false }]);
    const cmp = computeComparison(prev, curr as any);
    expect(cmp.avgLoops.direction).toBe('regressing');
    expect(cmp.approvalFailRate.direction).toBe('regressing');
    expect(cmp.successRate.direction).toBe('regressing');
  });
});

// readRunLog is a thin wrapper around fs; unit tests for it would require fs mocking and are omitted here.
