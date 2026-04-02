import { spawn } from 'child_process';
import * as path from 'path';
import { getFileSystem } from '../infrastructure/fileSystemProvider';
import { AgentRegistry } from '../registry/agentRegistry';
import { resolveRegistryPath } from '../context/pathUtils';
import { readLatestNRuns } from '../context/outputStore';

interface AgentExecutionResult {
  success: boolean;
  stdout: string;
  stderr: string;
}

function parseFrontmatterModel(content: string): string | undefined {
  const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(content);
  if (!match) {
    return undefined;
  }
  const modelLine = match[1].split(/\r?\n/).find((l) => l.startsWith('model:'));
  return modelLine ? modelLine.replace(/^model:\s*/, '').trim() : undefined;
}

export function executeAgent(
  registry: AgentRegistry,
  agentId: string,
  cwd: string,
  previousOutputPath?: string | null,
  prompt?: string,
  useLatest?: number | null,
  workflowArg?: string,
): Promise<AgentExecutionResult> {
  const fs = getFileSystem();
  const entry = registry[agentId];
  if (!entry) {
    throw new Error(`Agent '${agentId}' not found in registry`);
  }

  const fullPath = resolveRegistryPath(cwd, entry.path);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`Agent file not found: ${fullPath}`);
  }

  const content = fs.readFileSync(fullPath, 'utf8');
  const frontmatterModel = parseFrontmatterModel(content);
  const model = entry.model ?? frontmatterModel;

  let resolvedPrompt = prompt ?? 'Work according to your rules';

  if (previousOutputPath && fs.existsSync(previousOutputPath)) {
    // Prefer using the outputStore helper which understands run separators and n-selection

    const stateId = path.basename(previousOutputPath, path.extname(previousOutputPath));
    const history = readLatestNRuns(cwd, stateId, useLatest, workflowArg);
    // If readLatestNRuns returned null (no runs found), fall back to reading the whole file
    const finalHistory = history ?? fs.readFileSync(previousOutputPath, 'utf8').trim();
    if (finalHistory) {
      resolvedPrompt = `${resolvedPrompt}\n\nYour previous output(s):\n${finalHistory}`;
    }
  }

  // Ensure resolvedPrompt is never an empty string. Use default fallback when trimmed blank.
  if (!resolvedPrompt || resolvedPrompt.toString().trim() === '') {
    resolvedPrompt = 'Work according to your rules';
  }

  const args = [`--agent=${agentId}`, '--prompt', resolvedPrompt, '--yolo'];
  if (model) {
    args.splice(1, 0, `--model=${model}`);
  }

  return new Promise((resolve) => {
    const child = spawn('copilot', args, {
      cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk: Buffer) => {
      const text = chunk.toString();
      process.stdout.write(text); // stream live
      stdout += text;
    });

    child.stderr.on('data', (chunk: Buffer) => {
      const text = chunk.toString();
      process.stderr.write(text); // stream live
      stderr += text;
    });

    child.on('close', (code) => {
      resolve({ success: code === 0, stdout, stderr });
    });
  });
}

// New handler alias to conform to a "handler" naming convention used by abstractions
const executeAgentHandler = executeAgent;
