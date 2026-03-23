import * as fs from 'fs';
import * as path from 'path';
import { OutputConfig } from '../types';
import { resolveWorkflowDir } from './pathUtils';

const OUTPUTS_DIR = 'outputs';

function outputPath(cwd: string, stateId: string, workflowArg?: string): string {
  const workflowDir = resolveWorkflowDir(cwd, workflowArg);
  return path.join(workflowDir, OUTPUTS_DIR, `${stateId}.md`);
}

/**
 * Filter output based on OutputConfig settings.
 * Behavior: If a marker (default "OUTPUT:") is specified, find the first case-insensitive occurrence
 * and extract everything after it. If marker not found, use full output. Then trim leading/trailing
 * blank lines and apply tail if configured.
 */
export function filterOutput(output: string, config: OutputConfig): string {
  let result = output;

  const marker = config.marker ?? 'OUTPUT:';
  if (marker && typeof marker === 'string') {
    const lower = result.toLowerCase();
    const idx = lower.indexOf(marker.toLowerCase());
    if (idx !== -1) {
      result = result.slice(idx + marker.length);
    }
  }

  // Trim leading/trailing blank lines but preserve internal newlines
  const lines = result.split('\n');
  while (lines.length && lines[0].trim() === '') {
    lines.shift();
  }
  while (lines.length && lines[lines.length - 1].trim() === '') {
    lines.pop();
  }
  result = lines.join('\n');

  // Apply tail if specified
  if (config.tail && config.tail > 0) {
    const parts = result.split('\n');
    if (parts.length > config.tail) {
      result = parts.slice(-config.tail).join('\n');
    }
  }

  return result;
}

/**
 * Append output for a state to .raili/outputs/<stateId>.md.
 * Each run is separated by a timestamped header so the full history is preserved.
 */
export function saveOutput(
  cwd: string,
  stateId: string,
  output: string,
  outputConfig?: OutputConfig,
  workflowArg?: string,
): void {
  if (!outputConfig || !outputConfig.store) {
    return;
  }

  // Filter output based on config
  const filteredOutput = filterOutput(output, outputConfig);

  if (!filteredOutput) {
    return;
  }

  const workflowDir = resolveWorkflowDir(cwd, workflowArg);
  const dir = path.join(workflowDir, OUTPUTS_DIR);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const separator = `\n\n--- Run ${new Date().toISOString()} ---\n\n`;
  const entry = fs.existsSync(outputPath(cwd, stateId, workflowArg))
    ? separator + filteredOutput
    : filteredOutput;
  fs.appendFileSync(outputPath(cwd, stateId, workflowArg), entry, 'utf8');
}

/**
 * Load previous agent output for a state.
 * Returns the file path if the output file exists, null otherwise.
 */
export function loadAgentOutputPath(
  cwd: string,
  stateId: string,
  workflowArg?: string,
): string | null {
  const p = outputPath(cwd, stateId, workflowArg);
  return fs.existsSync(p) ? p : null;
}

/**
 * Read the latest run content for a state (text after the last run separator).
 * Returns null if no file exists or no content found.
 */
export function readLatestRun(cwd: string, stateId: string, workflowArg?: string): string | null {
  const p = outputPath(cwd, stateId, workflowArg);
  if (!fs.existsSync(p)) return null;
  const full = fs.readFileSync(p, 'utf8');
  const lastRunMarker = '--- Run ';
  const idx = full.lastIndexOf(lastRunMarker);
  if (idx !== -1) {
    const nl = full.indexOf('\n', idx);
    const start = nl !== -1 ? nl + 1 : idx + lastRunMarker.length;
    const content = full.slice(start).trim();
    return content === '' ? null : content;
  }
  const content = full.trim();
  return content === '' ? null : content;
}

/**
 * Delete saved output files for the given state IDs.
 * Silent if files do not exist.
 */
export function clearAgentOutputs(cwd: string, stateIds: string[], workflowArg?: string): void {
  for (const stateId of stateIds) {
    const p = outputPath(cwd, stateId, workflowArg);
    if (fs.existsSync(p)) {
      fs.unlinkSync(p);
    }
  }
}

/**
 * Delete all output files by removing the entire workflowDir/outputs directory.
 * Silent if the directory does not exist.
 */
export function clearAllOutputs(cwd: string, workflowArg?: string): void {
  const workflowDir = resolveWorkflowDir(cwd, workflowArg);
  const outputsDir = path.join(workflowDir, OUTPUTS_DIR);
  if (fs.existsSync(outputsDir)) {
    fs.rmSync(outputsDir, { recursive: true, force: true });
  }
}
