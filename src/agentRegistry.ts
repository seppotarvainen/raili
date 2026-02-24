import fs from 'fs';
import path from 'path';

export type AgentEntry = {
  path: string;
  model?: string;
};

export type AgentRegistry = Record<string, AgentEntry>;

export function loadAgentRegistry(dir: string): AgentRegistry {
  const registryPath = path.resolve(dir, '.raili', 'agent-registry.json');
  if (!fs.existsSync(registryPath)) throw new Error(`Agent registry not found at ${registryPath}`);
  const raw = fs.readFileSync(registryPath, 'utf8');
  let parsed: any;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    throw new Error(`Agent registry JSON parse error: ${(e as Error).message}`);
  }

  if (typeof parsed !== 'object' || Array.isArray(parsed) || parsed === null) {
    throw new Error('Agent registry must be an object mapping ids to entries');
  }

  for (const [k, v] of Object.entries(parsed)) {
    if (!v || typeof v !== 'object' || typeof (v as any).path !== 'string') {
      throw new Error(`Invalid agent registry entry for '${k}'`);
    }
    if ((v as any).model !== undefined && typeof (v as any).model !== 'string') {
      throw new Error(`Invalid agent registry entry for '${k}': model must be a string`);
    }
  }

  return parsed as AgentRegistry;
}
