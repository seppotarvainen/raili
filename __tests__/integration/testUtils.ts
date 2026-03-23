import fs from 'fs';
import os from 'os';
import path from 'path';
import {EventEmitter} from 'events';
import crypto from 'crypto';

/**
 * Create a temporary workspace with .raili/ and default .raili/main/ scaffold.
 * Uses os.tmpdir() so temp dirs are created outside the source tree.
 * Returns the absolute path to the workspace root.
 */
export function createTmpWorkspace(): string {
  const id = crypto.randomBytes(4).toString('hex');
  const dir = path.join(os.tmpdir(), `raili-test-${id}`);
  fs.mkdirSync(path.join(dir, '.raili', 'main', 'outputs'), { recursive: true });
  fs.mkdirSync(path.join(dir, '.raili', 'main', 'learnings'), { recursive: true });
  return dir;
}

/**
 * Recursively remove a temporary workspace directory.
 */
export function cleanupTmpWorkspace(dir: string): void {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

/** Write .raili/main/workflow.yaml */
export function writeWorkflow(dir: string, yamlContent: string): void {
  fs.writeFileSync(path.join(dir, '.raili', 'main', 'workflow.yaml'), yamlContent, 'utf8');
}

/** Write workflow.yaml for a named workflow directory (.raili/<name>/workflow.yaml) */
export function writeNamedWorkflow(dir: string, name: string, yamlContent: string): void {
  const wfDir = path.join(dir, '.raili', name);
  fs.mkdirSync(path.join(wfDir, 'outputs'), { recursive: true });
  fs.mkdirSync(path.join(wfDir, 'learnings'), { recursive: true });
  fs.writeFileSync(path.join(wfDir, 'workflow.yaml'), yamlContent, 'utf8');
}

/** Write arbitrary .raili/<filename> (kept for compatibility) */
function writeWorkflowFile(dir: string, filename: string, yamlContent: string): void {
  fs.writeFileSync(path.join(dir, '.raili', filename), yamlContent, 'utf8');
}

/** Write .raili/agent-registry.json */
export function writeAgentRegistry(dir: string, registry: object): void {
  fs.writeFileSync(
    path.join(dir, '.raili', 'agent-registry.json'),
    JSON.stringify(registry, null, 2),
    'utf8',
  );
}

/** Write .raili/script-registry.json */
export function writeScriptRegistry(dir: string, registry: object): void {
  fs.writeFileSync(
    path.join(dir, '.raili', 'script-registry.json'),
    JSON.stringify(registry, null, 2),
    'utf8',
  );
}

/** Write an agent markdown file at a relative path (creates parent directories). */
export function writeAgentFile(dir: string, relativePath: string, content: string): void {
  const fullPath = path.join(dir, relativePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, content, 'utf8');
}

/** Write a script file at a relative path (creates parent directories, chmod 755). */
export function writeScriptFile(dir: string, relativePath: string, content: string): void {
  const fullPath = path.join(dir, relativePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, content, 'utf8');
  fs.chmodSync(fullPath, 0o755);
}


/**
 * Creates a fake child process that emits stdout/stderr data then closes.
 */
export function fakeChild(stdoutData: string, stderrData: string, exitCode: number) {
  const child = new EventEmitter() as any;
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  setImmediate(() => {
    if (stdoutData) child.stdout.emit('data', Buffer.from(stdoutData));
    if (stderrData) child.stderr.emit('data', Buffer.from(stderrData));
    child.emit('close', exitCode);
  });
  return child;
}

/** Remove all RAILI_VAR_*, RAILI_FEEDBACK_*, and RAILI_MANUAL_CHOICE environment variables (cleanup helper). */
export function cleanupRailiEnvVars(): void {
  for (const key of Object.keys(process.env)) {
    if (key.startsWith('RAILI_VAR_') || key.startsWith('RAILI_FEEDBACK_')) {
      delete process.env[key];
    }
  }
  delete process.env.RAILI_MANUAL_CHOICE;
}
