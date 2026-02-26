import { executeCommand } from './commandHandler';

/**
 * Runs an optional notify command in the given working directory.
 * Failures are logged but do not abort the workflow — notification is best-effort.
 */
export async function runNotify(command: string, cwd: string): Promise<void> {
  const result = await executeCommand(command, cwd);
  if (!result.success) {
    console.warn(`  notify command failed (non-fatal): ${command}`);
  }
}

