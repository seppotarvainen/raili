import { executeCommand } from './commandHandler';

export interface NotifyResult {
  command: string;
  success: boolean;
  exitCode?: number;
  stderr?: string;
}

/**
 * Runs an optional notify command in the given working directory.
 * Vars are exposed as RAILI_VAR_<UPPERCASE> environment variables so shell
 * commands like `say "Done $RAILI_VAR_ID"` work correctly.
 * Returns a structured result so callers can persist notify metadata.
 * Failures are logged but do not abort the workflow — notification is best-effort.
 */
export async function runNotify(
  command: string,
  cwd: string,
  vars?: Record<string, string>,
): Promise<NotifyResult | undefined> {
  const envOverrides: Record<string, string> = {};
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      envOverrides[`RAILI_VAR_${k.toUpperCase()}`] = v;
    }
  }
  const result = await executeCommand(command, cwd, envOverrides);
  if (!result.success) {
    console.warn(`  notify command failed (non-fatal): ${command}`);
  }

  return {
    command,
    success: result.success,
    exitCode: result.exitCode,
    stderr: result.stderr || undefined,
  };
}
