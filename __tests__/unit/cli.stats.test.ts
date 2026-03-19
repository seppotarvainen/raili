import { computeMetrics, computeComparison, RunEntry, readRunLog, statsCommand } from '../../src/cli/stats';

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



// readRunLog is a thin wrapper around fs; add unit tests to verify parsing of the `states` field and statsCommand output.
import fs from 'fs';

describe('readRunLog and statsCommand', () => {
  const originalLog = `{"runId":"r1","states":3,"loops":0,"approvalFailures":0,"duration":1000,"success":true}\n{"runId":"r2","states":5,"loops":1,"approvalFailures":1,"duration":2000,"success":false}\n`;

  beforeEach(() => {
    jest.spyOn(fs, 'existsSync').mockImplementation(() => true);
    jest.spyOn(fs, 'readFileSync').mockImplementation(() => originalLog as any);
  });
  afterEach(() => {
    (fs.existsSync as jest.MockedFunction<any>).mockRestore();
    (fs.readFileSync as jest.MockedFunction<any>).mockRestore();
  });

  test('readRunLog parses states field and computeMetrics aggregates correctly', () => {
    const runs = readRunLog('/repo', 'main');
    expect(runs.length).toBe(2);
    expect((runs[0] as any).states).toBe(3);
    const metrics = computeMetrics(runs);
    expect(metrics.avgStates).toBeCloseTo((3 + 5) / 2);
  });

  test('statsCommand prints non-zero Average states/run', () => {
    const logs: string[] = [];
    jest.spyOn(console, 'log').mockImplementation((...args: any[]) => logs.push(args.join(' ')));
    try {
      statsCommand('/repo', 'main', 10);
      const line = logs.find((l) => l.includes('Average states/run:'));
      expect(line).toBeDefined();
      const m = line!.match(/Average states\/run:\s*(\d+\.\d+)/);
      expect(m).not.toBeNull();
      expect(parseFloat(m![1])).toBeGreaterThan(0);
    } finally {
      (console.log as jest.MockedFunction<any>).mockRestore();
    }
  });
});

