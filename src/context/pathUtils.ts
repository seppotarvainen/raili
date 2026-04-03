import os from 'os';
import path from 'path';
import { getFileSystem } from '../infrastructure/fileSystemProvider';

/**
 * Resolves a path that might contain a tilde (~) to an absolute path.
 */
function resolveHomePath(p: string): string {
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

/**
 * Resolve the directory that should contain workflow-scoped files (workflow.yaml, vars.yaml, outputs/, learnings/).
 * Rules:
 * - If workflowArg is not provided: prefer .raili/main/ if it exists, otherwise throw error
 * - If workflowArg is a bare name (no path separators): prefer .raili/<name>/ if it exists, otherwise throw error.
 */
export function resolveWorkflowDir(cwd: string, workflowArg?: string): string {
  const railiRoot = path.join(cwd, '.raili');

  if (!workflowArg) {
    const mainCandidate = path.join(railiRoot, 'main');
    const fs = getFileSystem();
    if (fs.existsSync(mainCandidate)) {
      return mainCandidate;
    }
    throw new Error('Unable to resolve workflow directory. No "main" directory found"');
  }

  // If bare name
  if (
    !workflowArg.includes(path.sep) &&
    !workflowArg.startsWith('./') &&
    !workflowArg.startsWith('../')
  ) {
    const candidate = path.join(railiRoot, workflowArg);
    const fs = getFileSystem();
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  throw new Error(
    'Unable to resolve workflow directory. Workflow argument must be a valid directory name inside .raili/',
  );
}

/**
 * Return the canonical path to the learnings file for an agent inside the workflow directory.
 */
export function learningsFilePath(cwd: string, agentId: string, workflowArg?: string): string {
  const workflowDir = resolveWorkflowDir(cwd, workflowArg);
  return path.join(workflowDir, 'learnings', `${agentId}.md`);
}

/**
 * Resolve the absolute path to an approval resolver file inside the workflow directory.
 * Returns the absolute path if the file exists, otherwise null.
 * Synchronous and will propagate unexpected FS errors.
 */
export function resolveApprovalResolverPath(workflowDir: string): string | null {
  const fs = getFileSystem();
  const p = path.join(workflowDir, 'approval-resolver.js');
  if (fs.existsSync(p)) {
    return p;
  }
  return null;
}

/**
 * Resolve the absolute path to a feedback resolver file inside the workflow directory.
 * Returns the absolute path if the file exists, otherwise null.
 * Synchronous and will propagate unexpected FS errors.
 */
export function resolveFeedbackResolverPath(workflowDir: string): string | null {
  const fs = getFileSystem();
  const p = path.join(workflowDir, 'feedback-resolver.js');
  if (fs.existsSync(p)) {
    return p;
  }
  return null;
}
