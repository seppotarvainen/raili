import * as fs from 'fs';
import * as path from 'path';
import { WorkflowContext, StateHistoryEntry } from './types';
import {clearAllOutputs} from "./outputStore";

/**
 * Load workflow context from .raili/context.json
 * Returns a new context if file doesn't exist
 * Backwards-compatible: accepts entries without `meta` fields.
 */
export function loadContext(cwd: string): WorkflowContext {
  const contextPath = path.join(cwd, '.raili', 'context.json');

  if (!fs.existsSync(contextPath)) {
    return {
      stateHistory: [],
    };
  }

  const content = fs.readFileSync(contextPath, 'utf8');
  const parsed = JSON.parse(content);

  // Validate structure
  if (!Array.isArray(parsed.stateHistory)) {
    throw new Error('Invalid context.json: stateHistory must be an array');
  }

  // Ensure old entries without meta still work
  parsed.stateHistory = parsed.stateHistory.map((e: any) => ({
    state: e.state,
    enteredAt: e.enteredAt,
    meta: e.meta ?? undefined,
  }));

  return parsed as WorkflowContext;
}

/**
 * Save workflow context to .raili/context.json
 */
export function saveContext(cwd: string, context: WorkflowContext): void {
  const railiDir = path.join(cwd, '.raili');

  if (!fs.existsSync(railiDir)) {
    throw new Error('.raili/ directory does not exist');
  }

  const contextPath = path.join(railiDir, 'context.json');
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
export function addStateToHistory(context: WorkflowContext, state: string, meta?: any): WorkflowContext {
  const now = new Date().toISOString();

  if (meta) {
    for (let i = context.stateHistory.length - 1; i >= 0; i--) {
      const entry = context.stateHistory[i];
      if (entry.state === state) {
        const merged: StateHistoryEntry = {
          ...entry,
          meta: {
            ...(entry.meta ?? {}),
            ...meta,
          },
        };
        const newHistory = [...context.stateHistory.slice(0, i), merged, ...context.stateHistory.slice(i + 1)];
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
 * Clear the persisted context file and all output files (used for a clean run)
 */
export function clearContext(cwd: string): void {
  const contextPath = path.join(cwd, '.raili', 'context.json');
  if (fs.existsSync(contextPath)) {
    fs.unlinkSync(contextPath);
  }
  clearAllOutputs(cwd);
}

/**
 * Initialize a fresh context with user-supplied vars.
 */
export function initializeContext(vars: Record<string, string>): WorkflowContext {
  return {
    vars,
    stateHistory: [],
  };
}

