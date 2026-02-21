import fs from 'fs';
import path from 'path';
import { loadAgentRegistry, AgentRegistry } from './agentRegistry';
import { loadScriptRegistry, ScriptRegistry } from './scriptRegistry';

export function validateAgentRegistry(dir: string): AgentRegistry {
  const reg = loadAgentRegistry(dir);
  // ensure each referenced file exists
  for (const [id, entry] of Object.entries(reg)) {
    const full = path.resolve(dir, entry.path);
    if (!fs.existsSync(full)) throw new Error(`Agent '${id}' references missing file: ${full}`);
  }
  return reg;
}

export function validateScriptRegistry(dir: string): ScriptRegistry {
  const reg = loadScriptRegistry(dir);
  for (const [id, entry] of Object.entries(reg)) {
    const full = path.resolve(dir, entry.path);
    if (!fs.existsSync(full)) throw new Error(`Script '${id}' references missing file: ${full}`);
  }
  return reg;
}
