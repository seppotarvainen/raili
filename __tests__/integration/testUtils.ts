import fs from 'fs';
import path from 'path';
import { EventEmitter } from 'events';
import crypto from 'crypto';

const INTEGRATION_DIR = path.resolve(__dirname);

/**
 * Create a temporary workspace directory with .raili/ subfolder.
 * Returns the absolute path to the workspace root.
 */
export function createTmpWorkspace(): string {
  const id = crypto.randomBytes(4).toString('hex');
  const dir = path.join(INTEGRATION_DIR, `tmp_${id}`);
  fs.mkdirSync(path.join(dir, '.raili'), { recursive: true });
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

/** Write .raili/workflow.yaml */
export function writeWorkflow(dir: string, yamlContent: string): void {
  fs.writeFileSync(path.join(dir, '.raili', 'workflow.yaml'), yamlContent, 'utf8');
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
 * Reuses the pattern from __tests__/unit/agentHandler.test.ts.
 */
export function fakeChild(stdoutData: string, stderrData: string, exitCode: number) {
  const child = new EventEmitter() as any;
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  // Emit asynchronously so listeners are attached first
  setImmediate(() => {
    if (stdoutData) child.stdout.emit('data', Buffer.from(stdoutData));
    if (stderrData) child.stderr.emit('data', Buffer.from(stderrData));
    child.emit('close', exitCode);
  });
  return child;
}

/** Remove all RAILI_VAR_* environment variables (cleanup helper). */
export function cleanupRailiEnvVars(): void {
  for (const key of Object.keys(process.env)) {
    if (key.startsWith('RAILI_VAR_')) {
      delete process.env[key];
    }
  }
}

