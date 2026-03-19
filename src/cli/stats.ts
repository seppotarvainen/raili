import * as fs from 'fs';
import * as path from 'path';
// Lightweight stats command implementation without external runtime deps

// Run entry type (lenient)
export type RunEntry = {
  runId?: string;
  durationMs?: number;
  duration?: number;
  loops?: number;
  approvalFailures?: number;
  stateCount?: number;
  statesVisited?: number;
  terminalState?: string;
  success?: boolean;
};

export function computeMetrics(runs: RunEntry[]) {
  const n = runs.length;
  if (n === 0) {
    return {
      count: 0,
      avgLoops: 0,
      approvalFailRate: 0,
      avgStates: 0,
      avgDurationMs: 0,
      successRate: null,
    };
  }

  let sumLoops = 0;
  let sumApprovalFailures = 0;
  let sumStates = 0;
  let sumDuration = 0;
  let successCount = 0;
  let successKnownCount = 0;

  for (const r of runs) {
    const loops = r.loops ?? 0;
    sumLoops += loops;
    sumApprovalFailures += r.approvalFailures ?? 0;
    const sc = r.stateCount ?? r.statesVisited ?? 0;
    sumStates += sc;
    const dur = r.durationMs ?? r.duration ?? 0;
    sumDuration += dur;
    if (typeof r.success === 'boolean') {
      successKnownCount++;
      if (r.success) successCount++;
    }
  }

  return {
    count: n,
    avgLoops: sumLoops / n,
    approvalFailRate: sumApprovalFailures / n,
    avgStates: sumStates / n,
    avgDurationMs: sumDuration / n,
    successRate: successKnownCount > 0 ? successCount / successKnownCount : null,
  };
}

function formatPct(v: number | null) {
  if (v === null) return 'n/a';
  return (v * 100).toFixed(1) + '%';
}

type Metrics = ReturnType<typeof computeMetrics>;

/**
 * Compare two metric snapshots and produce a simple trend descriptor.
 * For metrics where lower is better (loops, states, duration, approval failures), a decrease is "improving".
 * For successRate (higher is better), an increase is "improving".
 */
export function computeComparison(prev: Metrics | null, curr: Metrics) {
  const defs: {
    key: keyof Metrics;
    label: string;
    lowerIsBetter: boolean;
    format: (v: number | null) => string;
  }[] = [
    {
      key: 'avgLoops',
      label: 'Average loops/run',
      lowerIsBetter: true,
      format: (v) => (v as number).toFixed(2),
    },
    {
      key: 'avgStates',
      label: 'Average states/run',
      lowerIsBetter: true,
      format: (v) => (v as number).toFixed(2),
    },
    {
      key: 'avgDurationMs',
      label: 'Average duration (ms)',
      lowerIsBetter: true,
      format: (v) => Math.round(v as number).toString(),
    },
    {
      key: 'approvalFailRate',
      label: 'Approval failure rate',
      lowerIsBetter: true,
      format: (v) => formatPct(v as number | null),
    },
    {
      key: 'successRate',
      label: 'Success rate',
      lowerIsBetter: false,
      format: (v) => formatPct(v as number | null),
    },
  ];

  const result: Record<string, any> = {};
  for (const d of defs) {
    const prevVal = prev ? (prev as any)[d.key] : null;
    const currVal = (curr as any)[d.key] ?? null;
    let delta: number | null = null;
    if (prevVal === null || prevVal === undefined || currVal === null || currVal === undefined) {
      delta = null;
    } else {
      delta = (currVal as number) - (prevVal as number);
    }

    let direction: 'improving' | 'regressing' | 'no-change' | 'n/a' = 'n/a';
    let arrow = '-';
    if (delta === null) {
      direction = 'n/a';
      arrow = '-';
    } else if (Math.abs(delta) < 1e-9) {
      direction = 'no-change';
      arrow = '-';
    } else {
      const improving = d.lowerIsBetter ? delta < 0 : delta > 0;
      if (improving) {
        direction = 'improving';
        arrow = d.lowerIsBetter ? '↓' : '↑';
      } else {
        direction = 'regressing';
        arrow = d.lowerIsBetter ? '↑' : '↓';
      }
    }

    result[d.key] = {
      label: d.label,
      prev: prevVal,
      curr: currVal,
      delta,
      direction,
      arrow,
      formattedPrev:
        prevVal === null || prevVal === undefined ? 'n/a' : d.format(prevVal as number | null),
      formattedCurr:
        currVal === null || currVal === undefined ? 'n/a' : d.format(currVal as number | null),
    };
  }
  return result;
}

export function printMetrics(metrics: Metrics) {
  console.log(`Runs considered: ${metrics.count}`);
  console.log(`Average loops/run: ${metrics.avgLoops.toFixed(2)}`);
  console.log(`Average states/run: ${metrics.avgStates.toFixed(2)}`);
  console.log(`Average duration (ms): ${metrics.avgDurationMs.toFixed(0)}`);
  console.log(`Approval failure rate: ${formatPct(metrics.approvalFailRate)}`);
  console.log(`Success rate: ${formatPct(metrics.successRate)}`);
}

export function printComparison(prev: Metrics | null, curr: Metrics) {
  const cmp = computeComparison(prev, curr);
  console.log(`Runs considered (prev window): ${prev ? prev.count : 0}`);
  console.log(`Runs considered (current): ${curr.count}`);
  for (const key of Object.keys(cmp)) {
    const item = cmp[key];
    console.log(
      `${item.label}: ${item.formattedCurr} (${item.formattedPrev} ${item.arrow} ${item.direction})`,
    );
  }
}

export function readRunLog(cwd: string, workflow = 'main') {
  const runLogPath = path.join(cwd, '.raili', workflow, 'run-log.jsonl');
  if (!fs.existsSync(runLogPath)) {
    throw new Error(`Run log not found: ${runLogPath}`);
  }
  const raw = fs.readFileSync(runLogPath, 'utf8');
  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const parsed: RunEntry[] = [];
  for (const line of lines) {
    try {
      const obj = JSON.parse(line);
      // Lenient parsing: avoid runtime schema dependency. Coerce to RunEntry and accept missing fields.
      parsed.push(obj as RunEntry);
    } catch (err: any) {
      // skip malformed line but warn
      console.warn(
        `Skipping malformed run-log line: ${err && err.message ? err.message : String(err)}`,
      );
    }
  }
  return parsed;
}

export function statsCommand(cwd: string, workflow = 'main', latest = 10) {
  if (!Number.isInteger(latest) || latest <= 0)
    throw new Error('--latest must be a positive integer');
  const runs = readRunLog(cwd, workflow);
  const window = runs.slice(-latest);
  if (window.length === 0) {
    const metrics = computeMetrics([]);
    printMetrics(metrics);
    return;
  }

  if (window.length === 1) {
    const metrics = computeMetrics(window);
    printMetrics(metrics);
    return;
  }

  // Compare previous (all but last) vs current (last run)
  const prevWindow = window.slice(0, -1);
  const currWindow = [window[window.length - 1]];
  const prevMetrics = computeMetrics(prevWindow);
  const currMetrics = computeMetrics(currWindow);
  printComparison(prevMetrics, currMetrics);
}
