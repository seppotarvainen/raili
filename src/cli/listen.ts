import path from 'path';
import { getFileSystem } from '../infrastructure/fileSystemProvider';
import {
  resolveWorkflowDir,
  resolveTriggerPath,
  resolveResolverConfigPath,
} from '../context/pathUtils';
import { loadWorkflowConfig } from '../workflow/workflowLoader';
import { loadResolverConfig } from '../resolverConfigLoader';
import {
  validateAgentRegistry,
  validateScriptRegistry,
  validateWorkflowReferences,
} from '../registry/registryValidator';
import { loadTriggerModule } from '../handlers/triggerHandler';
import { runCommand } from '../run';
import type { ResolverConfig } from '../types';

function delay(ms: number) {
  return new Promise((res) => setTimeout(res, ms));
}

export function computeTriggerTimings(config: ResolverConfig | null) {
  const pollIntervalMs = (config?.trigger?.interval ?? 15) * 1000;
  const failureTimeoutMs = (config?.trigger?.timeout ?? 3600) * 1000;
  const retryIntervalMs = (config?.trigger?.retry_interval ?? 5) * 1000;
  return { pollIntervalMs, failureTimeoutMs, retryIntervalMs };
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

  // Load resolver configuration (optional) so listen uses configured intervals/backoff/timeouts
  const resolverConfigPath = resolveResolverConfigPath(workflowDir);
  const config = loadResolverConfig(resolverConfigPath);
  if (resolverConfigPath) {
    console.log(`Loaded resolver config from ${resolverConfigPath}`);
  }

  // Resolve and load trigger so trigger-related errors surface before registry validation
  const triggerPath = resolveTriggerPath(workflowDir);
  if (!triggerPath) {
    throw new Error(`Trigger not found for workflow at ${workflowDir}`);
  }

  const triggerFn = await loadTriggerModule(triggerPath);

  // Load workflow config and perform registry validation (fail-fast)
  const workflowConfig = loadWorkflowConfig(cwd, workflowPath);
  const agents = validateAgentRegistry(cwd);
  const scripts = validateScriptRegistry(cwd);
  validateWorkflowReferences(workflowConfig, agents, scripts);

  const { pollIntervalMs, failureTimeoutMs, retryIntervalMs } = computeTriggerTimings(config);
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
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('Trigger error:', msg);
      if (!failureStart) {
        failureStart = Date.now();
      } else if (Date.now() - failureStart > failureTimeoutMs) {
        throw new Error('Trigger failing continuously: aborting after timeout');
      }
      // Backoff a bit before retrying (configurable retry interval in seconds)
      await delay(retryIntervalMs);
    }
  }
}
