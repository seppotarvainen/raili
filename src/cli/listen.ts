import path from 'path';
import { getFileSystem } from '../infrastructure/fileSystemProvider';
import { resolveWorkflowDir, resolveTriggerPath } from '../context/pathUtils';
import { loadWorkflowConfig } from '../workflow/workflowLoader';
import {
  validateAgentRegistry,
  validateScriptRegistry,
  validateWorkflowReferences,
} from '../registry/registryValidator';
import { loadTriggerModule } from '../handlers/triggerHandler';
import { runCommand } from '../run';

function delay(ms: number) {
  return new Promise((res) => setTimeout(res, ms));
}

export async function listenCommand(cwd: string, workflowPath?: string): Promise<void> {
  const fs = getFileSystem();
  const railiDir = path.join(cwd, '.raili');
  if (!fs.existsSync(railiDir)) {
    throw new Error('.raili/ directory not found. Run `raili init` first.');
  }
  const stat = fs.statSync(railiDir);
  const isDir =
    typeof (stat as any).isDirectory === 'function'
      ? (stat as any).isDirectory()
      : Boolean((stat as any).isDirectory);
  if (!isDir) {
    throw new Error('.raili/ directory not found. Run `raili init` first.');
  }

  // Resolve workflow directory (throws if not resolvable)
  const workflowDir = resolveWorkflowDir(cwd, workflowPath);

  // Basic registry presence checks (fail-fast)
  const agentRegistryPath = path.join(railiDir, 'agent-registry.json');
  const scriptRegistryPath = path.join(railiDir, 'script-registry.json');
  if (!fs.existsSync(agentRegistryPath)) {
    throw new Error('agent-registry.json not found in .raili/');
  }
  if (!fs.existsSync(scriptRegistryPath)) {
    throw new Error('script-registry.json not found in .raili/');
  }

  // Resolve and load trigger early so trigger-related errors surface before workflow validation
  const triggerPath = resolveTriggerPath(workflowDir);
  if (!triggerPath) {
    throw new Error(`Trigger not found for workflow at ${workflowDir}`);
  }

  const triggerFn = await loadTriggerModule(triggerPath);

  // Load workflow config and validate registries/references after trigger checks
  const workflowConfig = loadWorkflowConfig(cwd, workflowPath);

  const agents = validateAgentRegistry(cwd);
  const scripts = validateScriptRegistry(cwd);
  validateWorkflowReferences(workflowConfig, agents, scripts);

  const pollIntervalMs = 15_000;
  const failureTimeoutMs = 10 * 60_000;
  let failureStart: number | null = null;

  // Poll loop
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      const event = await triggerFn();
      if (event === null) {
        // Reset failure counter on successful empty poll
        failureStart = null;
        await delay(pollIntervalMs);
        continue;
      }

      if (typeof event !== 'object' || Array.isArray(event)) {
        throw new Error('Trigger returned invalid event: must be an object or null');
      }

      // Start a clean run with the event variables
      await runCommand(cwd, 'clean', event as Record<string, string>, workflowPath, false);

      // Reset failure timer and wait before next poll
      failureStart = null;
      await delay(pollIntervalMs);
    } catch (err: any) {
      console.error('Trigger error:', err && err.message ? err.message : String(err));
      if (!failureStart) {
        failureStart = Date.now();
      } else if (Date.now() - failureStart > failureTimeoutMs) {
        throw new Error('Trigger failing continuously: aborting after timeout');
      }
      // Backoff a bit before retrying
      await delay(Math.min(5_000, pollIntervalMs));
    }
  }
}
