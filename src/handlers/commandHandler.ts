import { spawnSync } from 'child_process';

export type CommandExecutionResult = { success: boolean; output: string };

/**
 * Executes an inline shell command via `sh -c`.
 * Pipes, redirects, and env vars all work as in a normal shell.
 *
 * @param command  The shell command string to execute.
 * @param cwd      Working directory for the command.
 */
export function executeCommand(command: string, cwd: string): CommandExecutionResult {
  const result = spawnSync('sh', ['-c', command], { cwd, encoding: 'utf8' });

  const output = result.stdout ?? '';
  const stderr = result.stderr ?? '';
  const success = result.status === 0 && !result.error;

  return { success, output: success ? output : stderr || output };
}

