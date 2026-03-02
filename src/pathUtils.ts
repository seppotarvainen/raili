import os from 'os';
import path from 'path';

/**
 * Resolves a path that might contain a tilde (~) to an absolute path.
 */
export function resolveHomePath(p: string): string {
  if (p.startsWith('~/') || p === '~') {
    return path.join(os.homedir(), p.slice(1));
  }
  return p;
}

/**
 * Resolves a path relative to a base directory, supporting tilde (~) for the home directory.
 */
export function resolveRegistryPath(baseDir: string, p: string): string {
  const tildeResolved = resolveHomePath(p);
  if (path.isAbsolute(tildeResolved)) {
    return tildeResolved;
  }
  return path.resolve(baseDir, tildeResolved);
}

