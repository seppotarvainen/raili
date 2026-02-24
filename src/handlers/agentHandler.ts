import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { AgentRegistry } from '../agentRegistry';

export type AgentExecutionResult = {
  success: boolean;
  output: string;
};

function parseFrontmatterModel(content: string): string | undefined {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return undefined;
  const modelLine = match[1].split(/\r?\n/).find(l => l.startsWith('model:'));
  return modelLine ? modelLine.replace(/^model:\s*/, '').trim() : undefined;
}

export function executeAgent(registry: AgentRegistry, agentId: string, cwd: string): AgentExecutionResult {
  const entry = registry[agentId];
  if (!entry) throw new Error(`Agent '${agentId}' not found in registry`);

  const fullPath = path.resolve(cwd, entry.path);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`Agent file not found: ${fullPath}`);
  }

  const content = fs.readFileSync(fullPath, 'utf8');
  const frontmatterModel = parseFrontmatterModel(content);
  const model = entry.model ?? frontmatterModel;

  const args = [`--agent=${agentId}`, '--prompt', 'Work according to your rules', '--yolo'];
  if (model) args.splice(1, 0, `--model=${model}`);

  const result = spawnSync('copilot', args, { cwd, encoding: 'utf8' });

  const output = result.stdout ?? '';
  const stderr = result.stderr ?? '';
  const success = result.status === 0 && !result.error;

  return { success, output: success ? output : stderr || output };
}
