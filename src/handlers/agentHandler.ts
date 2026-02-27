import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { AgentRegistry } from '../agentRegistry';

export type AgentExecutionResult = {
  success: boolean;
  stdout: string;
  stderr: string;
};

function parseFrontmatterModel(content: string): string | undefined {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return undefined;
  const modelLine = match[1].split(/\r?\n/).find(l => l.startsWith('model:'));
  return modelLine ? modelLine.replace(/^model:\s*/, '').trim() : undefined;
}

export function executeAgent(registry: AgentRegistry, agentId: string, cwd: string, previousOutputPath?: string | null): Promise<AgentExecutionResult> {
  const entry = registry[agentId];
  if (!entry) throw new Error(`Agent '${agentId}' not found in registry`);

  const fullPath = path.resolve(cwd, entry.path);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`Agent file not found: ${fullPath}`);
  }

  const content = fs.readFileSync(fullPath, 'utf8');
  const frontmatterModel = parseFrontmatterModel(content);
  const model = entry.model ?? frontmatterModel;

  let prompt = 'Work according to your rules';
  if (previousOutputPath && fs.existsSync(previousOutputPath)) {
    const previousOutput = fs.readFileSync(previousOutputPath, 'utf8');
    prompt = `Work according to your rules.\n\nYour previous output was:\n${previousOutput}`;
  }

  const args = [`--agent=${agentId}`, '--prompt', prompt, '--yolo'];
  if (model) args.splice(1, 0, `--model=${model}`);


  return new Promise((resolve) => {
    const child = spawn('copilot', args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk: Buffer) => {
      const text = chunk.toString();
      process.stdout.write(text);  // stream live
      stdout += text;
    });

    child.stderr.on('data', (chunk: Buffer) => {
      const text = chunk.toString();
      process.stderr.write(text);  // stream live
      stderr += text;
    });

    child.on('close', (code) => {
      resolve({ success: code === 0, stdout, stderr });
    });
  });
}
