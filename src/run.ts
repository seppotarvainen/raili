/// <reference types="node" />
import * as fs from 'fs';
import * as path from 'path';

function readJsonFile(filePath: string) {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw);
  } catch (err: any) {
    throw new Error(`Invalid JSON in ${filePath}: ${err.message}`);
  }
}

export async function runCommand(cwd: string) {
  const railiDir = path.join(cwd, '.raili');
  if (!fs.existsSync(railiDir) || !fs.statSync(railiDir).isDirectory()) {
    throw new Error('.raili/ directory not found. Run `raili init` first.');
  }

  const agentRegistryPath = path.join(railiDir, 'agent-registry.json');
  const scriptRegistryPath = path.join(railiDir, 'script-registry.json');

  if (!fs.existsSync(agentRegistryPath)) {
    throw new Error('agent-registry.json not found in .raili/');
  }
  if (!fs.existsSync(scriptRegistryPath)) {
    throw new Error('script-registry.json not found in .raili/');
  }

  const agents = readJsonFile(agentRegistryPath);
  const scripts = readJsonFile(scriptRegistryPath);

  // For MVP, we only validate registries and return them.
  return { agents, scripts };
}
