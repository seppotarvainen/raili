import * as fs from 'fs';
import * as path from 'path';
import { OutputConfig } from './types';

const OUTPUTS_DIR = 'outputs';

function outputPath(cwd: string, stateId: string): string {
  return path.join(cwd, '.raili', OUTPUTS_DIR, `${stateId}.md`);
}

/**
 * Filter output based on OutputConfig settings.
 * Applies in order: search pattern (with after lines), then tail.
 */
export function filterOutput(output: string, config: OutputConfig): string {
  let result = output;

  // Step 1: Apply include_search_pattern if specified
  if (config.include_search_pattern) {
    try {
      const pattern = new RegExp(config.include_search_pattern);
      const lines = result.split('\n');
      const filtered: string[] = [];
      const afterCount = config.include_after ?? 0;

      for (let i = 0; i < lines.length; i++) {
        if (pattern.test(lines[i])) {
          // Add matching line and the next 'afterCount' lines
          filtered.push(lines[i]);
          for (let j = 1; j <= afterCount && i + j < lines.length; j++) {
            filtered.push(lines[i + j]);
          }
        }
      }

      // Only use filtered result if matches were found
      if (filtered.length > 0) {
        result = filtered.join('\n');
      }
    } catch (e) {
      console.warn(
        `Invalid regex pattern in include_search_pattern: ${config.include_search_pattern}`,
      );
    }
  }

  // Step 2: Apply tail if specified
  if (config.tail && config.tail > 0) {
    const lines = result.split('\n');
    if (lines.length > config.tail) {
      result = lines.slice(-config.tail).join('\n');
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
): void {
  if (!outputConfig || !outputConfig.store) {
    return;
  }

  // Filter output based on config
  const filteredOutput = filterOutput(output, outputConfig);

  if (!filteredOutput) {
    return;
  }

  const dir = path.join(cwd, '.raili', OUTPUTS_DIR);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const separator = `\n\n--- Run ${new Date().toISOString()} ---\n\n`;
  const entry = fs.existsSync(outputPath(cwd, stateId))
    ? separator + filteredOutput
    : filteredOutput;
  fs.appendFileSync(outputPath(cwd, stateId), entry, 'utf8');
}

/**
 * Load previous agent output for a state.
 * Returns the file path if the output file exists, null otherwise.
 */
export function loadAgentOutputPath(cwd: string, stateId: string): string | null {
  const p = outputPath(cwd, stateId);
  return fs.existsSync(p) ? p : null;
}

/**
 * Read the latest run content for a state (text after the last run separator).
 * Returns null if no file exists or no content found.
 */
export function readLatestRun(cwd: string, stateId: string): string | null {
  const p = outputPath(cwd, stateId);
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
export function clearAgentOutputs(cwd: string, stateIds: string[]): void {
  for (const stateId of stateIds) {
    const p = outputPath(cwd, stateId);
    if (fs.existsSync(p)) {
      fs.unlinkSync(p);
    }
  }
}

/**
 * Delete all output files by removing the entire .raili/outputs directory.
 * Silent if the directory does not exist.
 */
export function clearAllOutputs(cwd: string): void {
  const outputsDir = path.join(cwd, '.raili', OUTPUTS_DIR);
  if (fs.existsSync(outputsDir)) {
    fs.rmSync(outputsDir, { recursive: true, force: true });
  }
}
