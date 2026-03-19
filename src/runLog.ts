import * as fs from 'fs';
import * as path from 'path';
import { WorkflowConfig, StateHistoryEntry } from './types';
import { loadContext } from './context';
import { resolveWorkflowDir } from './pathUtils';

function humanDuration(ms: number): string {
  const s = Math.floor(ms / 1000);
  const hours = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = s % 60;
  if (hours > 0) return `${hours}h${mins}m${secs}s`;
  if (mins > 0) return `${mins}m${secs}s`;
  return `${secs}s`;
}

export function appendRunLog(
  cwd: string,
  workflowArg: string | undefined,
  runStartISO: string,
  workflowConfig: WorkflowConfig,
): void {
  // Resolve workflow directory path deterministically
  const workflowDir = path.join(cwd, '.raili', workflowArg || 'main');

  // Load context for this workflow (may be empty). Use loadContext which is test-friendly.
  let ctx: any;
  try {
    ctx = loadContext(cwd, workflowArg);
  } catch (err) {
    // If context is missing for unnamed runs, fall back to empty in-memory context
    ctx = { stateHistory: [], vars: {} };
  }

  // Filter entries that belong to this run (enteredAt >= runStartISO)
  const runStart = new Date(runStartISO);
  const allEntries: StateHistoryEntry[] = ctx.stateHistory || [];
  const entries = allEntries.filter((e: StateHistoryEntry) => {
    return new Date(e.enteredAt) >= runStart;
  });

  const states = entries.length;

  // visits per state within this run
  const visits: Record<string, number> = {};
  for (const e of entries) {
    visits[e.state] = (visits[e.state] || 0) + 1;
  }

  let loops = 0;
  for (const v of Object.values(visits)) {
    if (v > 1) loops += v - 1;
  }

  let approvalFailures = 0;
  for (const e of entries) {
    if (e.meta && e.meta.approval && e.meta.approval.chosen === 'FAILED') approvalFailures++;
  }

  const terminalEntry = entries[entries.length - 1] ?? null;
  const terminalState = terminalEntry ? terminalEntry.state : null;

  const output: any = {
    runId: runStartISO,
    vars: {},
    states,
    loops,
    approvalFailures,
    terminalState,
  };

  // Only include success if the engine recorded an explicit success value
  if (
    terminalEntry &&
    terminalEntry.meta &&
    terminalEntry.meta.success !== null &&
    terminalEntry.meta.success !== undefined
  ) {
    output.success = !!terminalEntry.meta.success;
  }

  // Duration: from runStart to terminalEntry.enteredAt (or now)
  const endTime =
    terminalEntry && terminalEntry.enteredAt ? new Date(terminalEntry.enteredAt) : new Date();
  const durationMs = endTime.getTime() - runStart.getTime();
  output.duration = durationMs >= 0 ? durationMs : 0;

  // Include only declared workflow inputs which are marked log: true
  for (const input of workflowConfig.inputs || []) {
    if (input.log) {
      output.vars[input.name] = ctx.vars[input.name];
    }
  }

  const logPath = path.join(workflowDir, 'run-log.jsonl');
  const line = JSON.stringify(output) + '\n';
  // Append atomically
  fs.appendFileSync(logPath, line, 'utf8');
}
