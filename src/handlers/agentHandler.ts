import { AgentRegistry } from '../agentRegistry';

export type AgentExecutionResult = {
  success: boolean;
  output: string;
};

export function executeAgent(registry: AgentRegistry, agentId: string, cwd: string): AgentExecutionResult {
  const entry = registry[agentId];
  if (!entry) throw new Error(`Agent '${agentId}' not found in registry`);

  // Mocked execution: read the file and return first line as deterministic output
  const fs = require('fs');
  const path = require('path');
  const fullPath = path.resolve(cwd, entry.path);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`Agent file not found: ${fullPath}`);
  }
  const content = fs.readFileSync(fullPath, 'utf8');
  const firstLine = content.split(/\r?\n/)[0] || '';
  return { success: true, output: `MOCKED_AGENT_OUTPUT: ${firstLine}` };
}
