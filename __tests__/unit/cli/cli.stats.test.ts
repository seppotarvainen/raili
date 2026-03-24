import { computeComparison, computeMetrics, readRunLog, RunEntry, statsCommand } from '../../../src/cli/stats';
import fs from 'fs';

// ─── helpers ────────────────────────────────────────────────────────────────

function makeLog(...runs: RunEntry[]): string {
  return runs.map((r) => JSON.stringify(r)).join('\n') + '\n';
}

function mockFs(log: string | null) {
  jest.spyOn(fs, 'existsSync').mockReturnValue(log !== null);
  if (log !== null) {
    jest.spyOn(fs, 'readFileSync').mockReturnValue(log as any);
  }
}

afterEach(() => {
  jest.restoreAllMocks();
});

// ─── computeMetrics ─────────────────────────────────────────────────────────

describe('computeMetrics', () => {
  test('returns zeros and null successRate for empty input', () => {
    const r = computeMetrics([]);
    expect(r.count).toBe(0);
    expect(r.avgLoops).toBe(0);
    expect(r.approvalFailRate).toBe(0);
    expect(r.avgStates).toBe(0);
    expect(r.avgDurationMs).toBe(0);
    expect(r.successRate).toBeNull();
  });

  test('uses durationMs field', () => {
    const r = computeMetrics([{ durationMs: 1000 }]);
    expect(r.avgDurationMs).toBe(1000);
  });

  test('falls back to duration alias when durationMs is absent', () => {
    const r = computeMetrics([{ duration: 500 }]);
    expect(r.avgDurationMs).toBe(500);
  });

  test('uses stateCount field', () => {
    const r = computeMetrics([{ stateCount: 4 }]);
    expect(r.avgStates).toBe(4);
  });

  test('falls back to states alias', () => {
    const r = computeMetrics([{ states: 7 }]);
    expect(r.avgStates).toBe(7);
  });

  test('falls back to statesVisited alias', () => {
    const r = computeMetrics([{ statesVisited: 3 }]);
    expect(r.avgStates).toBe(3);
  });

  test('missing optional fields default to 0', () => {
    const r = computeMetrics([{}]);
    expect(r.avgLoops).toBe(0);
    expect(r.approvalFailRate).toBe(0);
    expect(r.avgStates).toBe(0);
    expect(r.avgDurationMs).toBe(0);
  });

  test('success field undefined does not contribute to successRate', () => {
    const r = computeMetrics([{ loops: 1 }, { loops: 2 }]);
    expect(r.successRate).toBeNull();
  });

  test('computes successRate only from runs that have boolean success', () => {
    const r = computeMetrics([
      { success: true },
      { success: false },
      { loops: 1 }, // no success field — excluded
    ]);
    expect(r.successRate).toBeCloseTo(0.5);
    expect(r.count).toBe(3);
  });

  test('averages multiple runs across all fields', () => {
    const runs: RunEntry[] = [
      { loops: 2, approvalFailures: 1, stateCount: 5, durationMs: 1000, success: true },
      { loops: 0, approvalFailures: 0, stateCount: 3, durationMs: 500,  success: false },
      { loops: 1, approvalFailures: 2, stateCount: 4, durationMs: 1500, success: true },
    ];
    const r = computeMetrics(runs);
    expect(r.count).toBe(3);
    expect(r.avgLoops).toBeCloseTo(1);
    expect(r.approvalFailRate).toBeCloseTo(1);
    expect(r.avgStates).toBeCloseTo(4);
    expect(r.avgDurationMs).toBeCloseTo(1000);
    expect(r.successRate).toBeCloseTo(2 / 3);
  });
});

// ─── computeComparison ──────────────────────────────────────────────────────

describe('computeComparison', () => {
  const base = computeMetrics([
    { loops: 2, approvalFailures: 1, stateCount: 5, durationMs: 1000, success: true },
  ]);

  test('prev=null → direction n/a, arrow -, formattedPrev n/a for every metric', () => {
    const curr = computeMetrics([{ loops: 1, stateCount: 4, durationMs: 800, success: true }]);
    const cmp = computeComparison(null, curr);
    for (const key of Object.keys(cmp)) {
      expect(cmp[key].direction).toBe('n/a');
      expect(cmp[key].arrow).toBe('-');
      expect(cmp[key].formattedPrev).toBe('n/a');
    }
  });

  test('no-change (delta ≈ 0) → direction no-change, arrow -', () => {
    const same = computeMetrics([
      { loops: 2, approvalFailures: 1, stateCount: 5, durationMs: 1000, success: true },
    ]);
    const cmp = computeComparison(same, same);
    expect(cmp.avgLoops.direction).toBe('no-change');
    expect(cmp.avgLoops.arrow).toBe('-');
  });

  test('improving when lower-is-better metrics decrease', () => {
    const better = computeMetrics([{ loops: 1, approvalFailures: 0, stateCount: 4, durationMs: 800, success: true }]);
    const cmp = computeComparison(base, better);
    expect(cmp.avgLoops.direction).toBe('improving');
    expect(cmp.avgLoops.arrow).toBe('↓');
    expect(cmp.avgStates.direction).toBe('improving');
    expect(cmp.avgDurationMs.direction).toBe('improving');
    expect(cmp.approvalFailRate.direction).toBe('improving');
  });

  test('regressing when lower-is-better metrics increase', () => {
    const worse = computeMetrics([{ loops: 5, approvalFailures: 3, stateCount: 10, durationMs: 5000, success: false }]);
    const cmp = computeComparison(base, worse);
    expect(cmp.avgLoops.direction).toBe('regressing');
    expect(cmp.avgLoops.arrow).toBe('↑');
    expect(cmp.avgStates.direction).toBe('regressing');
    expect(cmp.approvalFailRate.direction).toBe('regressing');
  });

  test('successRate improving when it increases (higher is better)', () => {
    const prevLow  = computeMetrics([{ success: false }]);
    const currHigh = computeMetrics([{ success: true }]);
    const cmp = computeComparison(prevLow, currHigh);
    expect(cmp.successRate.direction).toBe('improving');
    expect(cmp.successRate.arrow).toBe('↑');
  });

  test('successRate regressing when it decreases', () => {
    const prevHigh = computeMetrics([{ success: true }]);
    const currLow  = computeMetrics([{ success: false }]);
    const cmp = computeComparison(prevHigh, currLow);
    expect(cmp.successRate.direction).toBe('regressing');
    expect(cmp.successRate.arrow).toBe('↓');
  });

  test('null successRate in curr → n/a direction and formattedCurr n/a', () => {
    const noSuccess = computeMetrics([{ loops: 1 }]); // no success field → successRate null
    const cmp = computeComparison(base, noSuccess);
    expect(cmp.successRate.direction).toBe('n/a');
    expect(cmp.successRate.formattedCurr).toBe('n/a');
  });

  test('formattedPrev and formattedCurr are human-readable strings', () => {
    const curr = computeMetrics([{ loops: 1, stateCount: 3, durationMs: 500, success: true }]);
    const cmp = computeComparison(base, curr);
    expect(cmp.avgLoops.formattedPrev).toMatch(/^\d+\.\d+$/);
    expect(cmp.avgLoops.formattedCurr).toMatch(/^\d+\.\d+$/);
    expect(cmp.successRate.formattedPrev).toContain('%');
    expect(cmp.successRate.formattedCurr).toContain('%');
  });
});

// ─── readRunLog ─────────────────────────────────────────────────────────────

describe('readRunLog', () => {
  test('throws when run-log.jsonl does not exist', () => {
    jest.spyOn(fs, 'existsSync').mockReturnValue(false);
    expect(() => readRunLog('/repo', 'main')).toThrow(/Run log not found/);
  });

  test('parses valid jsonl entries', () => {
    mockFs(makeLog(
      { loops: 0, states: 3, durationMs: 1000, success: true },
      { loops: 1, states: 5, durationMs: 2000, success: false },
    ));
    const runs = readRunLog('/repo', 'main');
    expect(runs).toHaveLength(2);
    expect((runs[0] as any).states).toBe(3);
    expect((runs[1] as any).loops).toBe(1);
  });

  test('skips malformed JSON lines and emits a console.warn', () => {
    mockFs('{"loops":1,"states":3}\nnot-valid-json\n{"loops":2,"states":4}\n');
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const runs = readRunLog('/repo', 'main');
    expect(runs).toHaveLength(2);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0][0]).toMatch(/Skipping malformed/);
  });

  test('handles CRLF line endings', () => {
    mockFs('{"loops":1}\r\n{"loops":2}\r\n');
    const runs = readRunLog('/repo', 'main');
    expect(runs).toHaveLength(2);
  });

  test('uses default workflow=main when not provided', () => {
    const existsSpy = jest.spyOn(fs, 'existsSync').mockReturnValue(true);
    jest.spyOn(fs, 'readFileSync').mockReturnValue('{"loops":1}\n' as any);
    readRunLog('/repo');
    expect(String(existsSpy.mock.calls[0][0])).toContain('main');
  });
});

// ─── statsCommand ────────────────────────────────────────────────────────────

describe('statsCommand', () => {
  function captureLog(fn: () => void): string[] {
    const lines: string[] = [];
    jest.spyOn(console, 'log').mockImplementation((...args: any[]) => lines.push(args.join(' ')));
    fn();
    return lines;
  }

  test('throws for non-integer latest (1.5)', () => {
    expect(() => statsCommand('/repo', 'main', 1.5)).toThrow(/positive integer/);
  });

  test('throws for latest <= 0', () => {
    expect(() => statsCommand('/repo', 'main', 0)).toThrow(/positive integer/);
    expect(() => statsCommand('/repo', 'main', -3)).toThrow(/positive integer/);
  });

  test('0 runs: printMetrics shows Runs considered: 0 and Success rate: n/a', () => {
    mockFs('');
    const lines = captureLog(() => statsCommand('/repo', 'main', 10));
    expect(lines.some((l) => l.includes('Runs considered: 0'))).toBe(true);
    expect(lines.some((l) => l.includes('Average loops/run: 0.00'))).toBe(true);
    expect(lines.some((l) => l.includes('Success rate: n/a'))).toBe(true);
  });

  test('1 run: printMetrics shows Runs considered: 1 and computed values', () => {
    mockFs(makeLog({ loops: 2, states: 4, durationMs: 500, success: true }));
    const lines = captureLog(() => statsCommand('/repo', 'main', 10));
    expect(lines.some((l) => l.includes('Runs considered: 1'))).toBe(true);
    expect(lines.some((l) => l.includes('Average loops/run: 2.00'))).toBe(true);
    expect(lines.some((l) => l.includes('Success rate: 100.0%'))).toBe(true);
  });

  test('multiple runs: printComparison shows prev/current window counts', () => {
    mockFs(makeLog(
      { loops: 3, states: 10, durationMs: 2000, success: true },
      { loops: 1, states: 5,  durationMs: 500,  success: true },
    ));
    const lines = captureLog(() => statsCommand('/repo', 'main', 10));
    expect(lines.some((l) => l.includes('Runs considered (prev window): 1'))).toBe(true);
    expect(lines.some((l) => l.includes('Runs considered (current): 1'))).toBe(true);
  });

  test('latest=1 on a 3-run log triggers single-run path (no prev window line)', () => {
    mockFs(makeLog(
      { loops: 3, states: 10, durationMs: 2000, success: true },
      { loops: 2, states: 8,  durationMs: 1500, success: true },
      { loops: 1, states: 5,  durationMs: 500,  success: true },
    ));
    const lines = captureLog(() => statsCommand('/repo', 'main', 1));
    expect(lines.some((l) => l.includes('Runs considered: 1'))).toBe(true);
    expect(lines.every((l) => !l.includes('prev window'))).toBe(true);
  });

  test('latest=2 on a 3-run log triggers comparison path', () => {
    mockFs(makeLog(
      { loops: 3, states: 10, durationMs: 2000, success: true },
      { loops: 2, states: 8,  durationMs: 1500, success: true },
      { loops: 1, states: 5,  durationMs: 500,  success: true },
    ));
    const lines = captureLog(() => statsCommand('/repo', 'main', 2));
    expect(lines.some((l) => l.includes('prev window'))).toBe(true);
  });

  test('comparison output includes trend arrows and direction labels', () => {
    mockFs(makeLog(
      { loops: 4, states: 10, durationMs: 2000, success: true }, // prev
      { loops: 1, states: 3,  durationMs: 300,  success: true }, // current — better
    ));
    const lines = captureLog(() => statsCommand('/repo', 'main', 10));
    const loopLine = lines.find((l) => l.includes('Average loops/run:'));
    expect(loopLine).toContain('improving');
    expect(loopLine).toContain('↓');
  });
});
