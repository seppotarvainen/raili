import { StateDef } from '../types';
import { saveOutput, outputPath } from '../context/outputStore';
import { parseExports } from '../variables/variableExports';
import type { StateResult } from './runner';

/** Execution result shape shared by script and command handlers. */
interface HandlerResult {
  success: boolean;
  stdout: string;
  stderr: string;
}

/**
 * Build RAILI_VAR_ environment overrides from workflow vars.
 */
export function buildEnvOverrides(vars?: Record<string, string>): Record<string, string> {
  const env: Record<string, string> = {};
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      env[`RAILI_VAR_${k.toUpperCase()}`] = v;
    }
  }
  return env;
}

/**
 * Store combined stdout+stderr output if the state has an output config.
 */
function storeOutput(
  cwd: string,
  state: StateDef,
  result: HandlerResult,
  workflowArg?: string,
): void {
  if (!state.config.output) {
    return;
  }
  const combined = [result.stdout, result.stderr].filter(Boolean).join('\n');
  if (!combined) {
    return;
  }
  saveOutput(cwd, state.id, combined, state.config.output, workflowArg);
}

/**
 * Parse exposed variables from stdout if the state declares `expose`.
 */
function parseExposedVars(state: StateDef, stdout: string): Record<string, string> {
  const exports: Record<string, string> = {};
  if (state.config.expose?.length) {
    const parsed = parseExports(stdout, state.config.expose);
    for (const [k, v] of Object.entries(parsed)) {
      exports[k] = v;
    }
  }
  return exports;
}

/**
 * Determine the outcome string from a handler result based on state routing config.
 * - `on:` routing → binary PASSED/FAILED from exit code
 * - `transitions:` routing → last line of stdout as outcome key
 * - fallback → binary PASSED/FAILED
 */
function resolveOutcome(
  state: StateDef,
  result: HandlerResult,
  handlerType: 'script' | 'command',
): string {
  if (state.config.on) {
    return result.success ? 'PASSED' : 'FAILED';
  }
  if (state.config.transitions) {
    const lastLine = result.stdout.trimEnd().split('\n').pop()?.trim() ?? '';
    if (!lastLine) {
      throw new Error(
        `State '${state.id}': ${handlerType} produced no output — expected a transition key as last stdout line`,
      );
    }
    return lastLine;
  }
  return result.success ? 'PASSED' : 'FAILED';
}

/**
 * Shared post-execution processing for script and command states.
 * Handles output storage, expose parsing, and outcome resolution.
 */
export function processStateResult(
  cwd: string,
  state: StateDef,
  result: HandlerResult,
  handlerType: 'script' | 'command',
  workflowArg?: string,
): StateResult {
  storeOutput(cwd, state, result, workflowArg);
  const exports = parseExposedVars(state, result.stdout);
  const outcome = resolveOutcome(state, result, handlerType);
  return { outcome, exports };
}

/**
 * Return the canonical output path for a state inside the workflow directory.
 * This helper exposes the underlying output path computation in a testable place.
 */
export function resolveStateOutputPath(cwd: string, stateId: string, workflowArg?: string): string {
  return outputPath(cwd, stateId, workflowArg);
}
