import {getFileSystem} from '../infrastructure/fileSystemProvider';
import path from 'path';

export interface ScriptEntry {
  path: string;
  runtime?: string;
}
export type ScriptRegistry = Record<string, ScriptEntry>;

export function loadScriptRegistry(dir: string): ScriptRegistry {
  const fs = getFileSystem();
  const registryPath = path.resolve(dir, '.raili', 'script-registry.json');
  if (!fs.existsSync(registryPath)) {
    throw new Error(`Script registry not found at ${registryPath}`);
  }
  const raw = fs.readFileSync(registryPath, 'utf8');
  let parsed: any;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    throw new Error(`Script registry JSON parse error: ${(e as Error).message}`);
  }

  if (typeof parsed !== 'object' || Array.isArray(parsed) || parsed === null) {
    throw new Error('Script registry must be an object mapping ids to entries');
  }

  for (const [k, v] of Object.entries(parsed)) {
    if (!v || typeof v !== 'object' || typeof (v as any).path !== 'string') {
      throw new Error(`Invalid script registry entry for '${k}'`);
    }
    if (
      (v as any).runtime !== undefined &&
      (typeof (v as any).runtime !== 'string' || (v as any).runtime.trim() === '')
    ) {
      throw new Error(`Invalid script registry entry for '${k}': runtime must be a non-empty string`);
    }
  }

  return parsed as ScriptRegistry;
}
