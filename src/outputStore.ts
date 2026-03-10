import * as fs from 'fs';
import * as path from 'path';

const OUTPUTS_DIR = 'outputs';

function outputPath(cwd: string, stateId: string): string {
  return path.join(cwd, '.raili', OUTPUTS_DIR, `${stateId}.md`);
}

/**
 * Append output for a state to .raili/outputs/<stateId>.md.
 * Each run is separated by a timestamped header so the full history is preserved.
 */
export function saveOutput(cwd: string, stateId: string, output: string): void {
  const dir = path.join(cwd, '.raili', OUTPUTS_DIR);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const separator = `\n\n--- Run ${new Date().toISOString()} ---\n\n`;
  const entry = fs.existsSync(outputPath(cwd, stateId))
    ? separator + output
    : output;
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
