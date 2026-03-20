import * as fs from 'fs';
import * as path from 'path';
import { WorkflowContext, StateHistoryEntry } from './types';
import { clearAllOutputs } from './outputStore';
import { resolveWorkflowDir } from './pathUtils';

/**
 * Load workflow context from workflowDir/context.json.
 * Returns an empty context if the file doesn't exist (non-workflow-scoped runs only).
 * Backwards-compatible: accepts entries without `meta` fields.
 */
export function loadContext(cwd: string, workflowArg?: string): WorkflowContext {
  const workflowDir = resolveWorkflowDir(cwd, workflowArg);
  const contextPath = path.join(workflowDir, 'context.json');

  if (!fs.existsSync(contextPath)) {
    if (workflowArg) {
      throw new Error(
        `Missing context.json for workflow '${workflowArg}'. Cannot run without an existing context.`,
      );
    }
    return { stateHistory: [] };
  }

  const parsed = JSON.parse(fs.readFileSync(contextPath, 'utf8'));

  if (!Array.isArray(parsed.stateHistory)) {
    throw new Error('Invalid context.json: stateHistory must be an array');
  }

  parsed.stateHistory = parsed.stateHistory.map((e: any) => ({
    state: e.state,
    enteredAt: e.enteredAt,
    meta: e.meta ?? undefined,
  }));

  parsed.vars = parsed.vars ?? {};
  parsed.approvals = parsed.approvals ?? {};

  return parsed as WorkflowContext;
}

/**
 *
 * Save workflow context to workflowDir/context.json
 */
export function saveContext(cwd: string, context: WorkflowContext, workflowArg?: string): void {
  const workflowDir = resolveWorkflowDir(cwd, workflowArg);

  // Ensure .raili/ (or workflowDir) exists
  if (!fs.existsSync(workflowDir)) {
    throw new Error('.raili/ workflow directory does not exist: ' + workflowDir);
  }

  const contextPath = path.join(workflowDir, 'context.json');
  fs.writeFileSync(contextPath, JSON.stringify(context, null, 2), 'utf8');
}

/**
 * Get the current state from context history
 * Returns null if no states in history
 */
export function getCurrentState(context: WorkflowContext): string | null {
  if (context.stateHistory.length === 0) {
    return null;
  }

  // States are ordered by timestamp, so the last one is current
  return context.stateHistory[context.stateHistory.length - 1].state;
}

/**
 * Get the previous state (the one before current)
 * Used by manual-approve to determine which state triggered the approval
 */
export function getPreviousState(context: WorkflowContext): string | null {
  if (context.stateHistory.length < 2) {
    return null;
  }

  return context.stateHistory[context.stateHistory.length - 2].state;
}

/**
 * Add a new state to the history with current timestamp.
 * If a `meta` object is supplied, merge it into the most recent existing
 * history entry for the same state (searching from the end). This ensures
 * metadata is attached to the state where it occurred even if a later state
 * was already appended (routing from previous states).
 */
export function addStateToHistory(
  context: WorkflowContext,
  state: string,
  meta?: any,
): WorkflowContext {
  const now = new Date().toISOString();

  if (meta) {
    for (let i = context.stateHistory.length - 1; i >= 0; i--) {
      const entry = context.stateHistory[i];
      if (entry.state === state) {
        // Merge metadata into existing entry. If both existing and new meta contain numeric
        // waitMs values, accumulate them to preserve total idle wait time across multiple prompts.
        const existingMeta = entry.meta ?? {};
        const mergedMeta: any = { ...existingMeta };
        for (const [k, v] of Object.entries(meta)) {
          if (k === 'waitMs' && typeof existingMeta.waitMs === 'number' && typeof v === 'number') {
            mergedMeta.waitMs = (existingMeta.waitMs as number) + (v as number);
          } else {
            mergedMeta[k] = v;
          }
        }

        const merged: StateHistoryEntry = {
          ...entry,
          meta: mergedMeta,
        };
        const newHistory = [
          ...context.stateHistory.slice(0, i),
          merged,
          ...context.stateHistory.slice(i + 1),
        ];
        return { ...context, stateHistory: newHistory };
      }
    }
  } else {
    const last = context.stateHistory[context.stateHistory.length - 1];
    if (last && last.state === state) {
      return context;
    }
  }

  const entry: StateHistoryEntry = {
    state,
    enteredAt: now,
    meta: meta ?? undefined,
  };

  return {
    ...context,
    stateHistory: [...context.stateHistory, entry],
  };
}

/**
 *
 * Clear the persisted context file and all output files (used for a clean run)
 */
export function clearContext(cwd: string, workflowArg?: string): void {
  const workflowDir = resolveWorkflowDir(cwd, workflowArg);
  const contextPath = path.join(workflowDir, 'context.json');
  if (fs.existsSync(contextPath)) {
    fs.unlinkSync(contextPath);
  }
  clearAllOutputs(cwd, workflowArg);
}

/**
 * Initialize a fresh context with user-supplied vars.
 */
export function initializeContext(vars: Record<string, string>): WorkflowContext {
  return {
    vars,
    approvals: {},
    stateHistory: [],
  };
}
