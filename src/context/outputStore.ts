import { getFileSystem } from '../infrastructure/fileSystemProvider';
import * as path from 'path';
import { OutputConfig } from '../types';
import { resolveWorkflowDir } from './pathUtils';

const OUTPUTS_DIR = 'outputs';

export function outputPath(cwd: string, stateId: string, workflowArg?: string): string {
  const workflowDir = resolveWorkflowDir(cwd, workflowArg);
  // For group sub-states the runtime uses virtual ids like "group.sub".
  // Persist outputs using only the final segment (the sub-state name) so files
  // are named `<state>.md` consistently. Older parent-prefixed filenames are
  // no longer supported.
  const base = stateId.includes('.') ? stateId.split('.').pop()! : stateId;
  return path.join(workflowDir, OUTPUTS_DIR, `${base}.md`);
}

/**
 * Filter output based on OutputConfig settings.
 * New behavior supports optional marker and marker_end fields. Searches are case-insensitive
 * but slicing preserves original case/spacing.
 * Rules:
 * - If neither marker nor marker_end provided => keep full output
 * - If only marker provided => return everything after first occurrence of marker
 * - If only marker_end provided => return everything before first occurrence of marker_end
 * - If both provided => find first marker and the first marker_end after it; return the substring between them.
 *   If marker_end occurs before marker or no marker_end after marker is found, behave as marker-only (everything after marker).
 * After extraction trim leading/trailing blank lines and apply tail if configured.
 */
export function filterOutput(output: string, config: OutputConfig): string {
  let result = output;
  const marker = config.marker;
  const markerEnd = config.marker_end;

  if (marker && typeof marker === 'string') {
    const lowerFull = output.toLowerCase();
    const lowerMarker = marker.toLowerCase();
    const startIdx = lowerFull.indexOf(lowerMarker);
    if (startIdx !== -1) {
      const contentStart = startIdx + marker.length;
      // Default to everything after the marker
      result = output.slice(contentStart);

      // If marker_end provided, look for it after the contentStart index
      if (markerEnd && typeof markerEnd === 'string') {
        const lowerMarkerEnd = markerEnd.toLowerCase();
        const endIdx = lowerFull.indexOf(lowerMarkerEnd, contentStart);
        if (endIdx !== -1) {
          // Extract between start and end (preserve original casing)
          result = output.slice(contentStart, endIdx);
        }
        // If endIdx not found after start, keep everything after marker (marker-only behavior)
      }
    }
    // If marker not found, fallthrough to other cases
  }

  // If marker was not provided or not found, but marker_end is provided, extract before first marker_end
  if (
    (marker === undefined ||
      marker === null ||
      (typeof marker === 'string' && !output.toLowerCase().includes(marker.toLowerCase()))) &&
    markerEnd &&
    typeof markerEnd === 'string'
  ) {
    const lowerFull = output.toLowerCase();
    const endIdx = lowerFull.indexOf(markerEnd.toLowerCase());
    if (endIdx !== -1) {
      result = output.slice(0, endIdx);
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

  // If result is empty after trimming, return empty string so callers may skip saving
  if (result.trim() === '') {
    return '';
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
  if (!outputConfig?.store) {
    return;
  }

  const fs = getFileSystem();

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

  // Also save the latest filtered output in overwrite mode
  saveLatestOutput(cwd, stateId, output, outputConfig, workflowArg);
}

export function saveLatestOutput(
  cwd: string,
  stateId: string,
  output: string,
  outputConfig?: OutputConfig,
  workflowArg?: string,
): void {
  if (!outputConfig?.store) {
    return;
  }

  const fs = getFileSystem();

  // Apply the same filtering rules as saveOutput
  const filtered = filterOutput(output, outputConfig);
  if (!filtered) {
    return;
  }

  const workflowDir = resolveWorkflowDir(cwd, workflowArg);
  const dir = path.join(workflowDir, OUTPUTS_DIR);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // Derive latest file path from the standard outputPath (replace .md with .latest.md)
  const standard = outputPath(cwd, stateId, workflowArg);
  const latestPath = standard.endsWith('.md')
    ? standard.slice(0, -3) + '.latest.md'
    : standard + '.latest.md';

  fs.writeFileSync(latestPath, filtered, 'utf8');
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
  const fs = getFileSystem();
  const p = outputPath(cwd, stateId, workflowArg);
  return fs.existsSync(p) ? p : null;
}

/**
 * Read the latest run content for a state (text after the last run separator).
 * Returns null if no file exists or no content found.
 */
export function readLatestRun(cwd: string, stateId: string, workflowArg?: string): string | null {
  const fs = getFileSystem();
  const p = outputPath(cwd, stateId, workflowArg);
  if (!fs.existsSync(p)) {
    return null;
  }
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
 * Read the latest N runs for a state output file and concatenate them.
 *
 * Behavior:
 * - If file missing: return null
 * - If n is undefined or null: return all runs concatenated (oldest->newest)
 * - If n <= 0: return empty string
 * - If n provided: return the latest n runs in chronological order (oldest->newest)
 * - Preserve run separators (`--- Run ...`) as they appear in the file
 */
export function readLatestNRuns(
  cwd: string,
  stateId: string,
  n?: number | null,
  workflowArg?: string,
): string | null {
  const fs = getFileSystem();
  const p = outputPath(cwd, stateId, workflowArg);
  if (!fs.existsSync(p)) {
    return null;
  }

  const full = fs.readFileSync(p, 'utf8');

  // Per contract, non-positive n returns empty string
  if (n !== undefined && n !== null && n <= 0) {
    return '';
  }

  const lastRunMarker = '--- Run ';
  const indices: number[] = [];
  let idx = full.indexOf(lastRunMarker);
  while (idx !== -1) {
    indices.push(idx);
    idx = full.indexOf(lastRunMarker, idx + 1);
  }

  let runs: string[] = [];
  if (indices.length === 0) {
    // Entire file is a single run
    runs = [full];
  } else {
    // Include the initial part before the first marker as the first run
    const firstMarker = indices[0];
    const before = full.slice(0, firstMarker);
    runs.push(before);

    // Each subsequent run includes the marker line and the content until the next marker
    for (let i = 0; i < indices.length; i++) {
      const start = indices[i];
      const end = i + 1 < indices.length ? indices[i + 1] : full.length;
      runs.push(full.slice(start, end));
    }
  }

  // If caller requested all runs
  if (n === undefined || n === null) {
    const res = runs.join('').trim();
    return res === '' ? null : res;
  }

  // n is positive (handled <=0 above)
  const selected = runs.slice(-n);
  const res = selected.join('').trim();
  return res === '' ? null : res;
}

/**
 * Delete saved output files for the given state IDs.
 * Silent if files do not exist.
 */
export function clearAgentOutputs(cwd: string, stateIds: string[], workflowArg?: string): void {
  const fs = getFileSystem();
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
  const fs = getFileSystem();
  const workflowDir = resolveWorkflowDir(cwd, workflowArg);
  const outputsDir = path.join(workflowDir, OUTPUTS_DIR);
  if (fs.existsSync(outputsDir)) {
    fs.rmSync(outputsDir, { recursive: true, force: true });
  }
}
