import { spawn } from 'child_process';

export type CommandExecutionResult = { success: boolean; stdout: string; stderr: string };

export function executeCommand(command: string, cwd: string, envOverrides: Record<string,string> = {}): Promise<CommandExecutionResult> {
  return new Promise((resolve) => {
    const child = spawn('sh', ['-c', command], { cwd, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, ...envOverrides } });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk: Buffer) => {
      const text = chunk.toString();
      process.stdout.write(text);
      stdout += text;
    });

    child.stderr.on('data', (chunk: Buffer) => {
      const text = chunk.toString();
      process.stderr.write(text);
      stderr += text;
    });

    child.on('close', (code) => {
      resolve({ success: code === 0, stdout, stderr });
    });
  });
}

