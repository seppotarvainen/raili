/// <reference types="node" />
import * as fs from 'fs';
import * as path from 'path';
import { loadWorkflowConfig, buildStateMachine, validateStateMachine } from './workflowLoader';
import {
  validateAgentRegistry,
  validateScriptRegistry,
  validateWorkflowReferences,
} from './registryValidator';
import { loadContext, clearContext, initializeContext } from './context';
import { Engine } from './engine/Engine';
import { appendRunLog } from './runLog';
import { loadVarsFile } from './varsLoader';
import { handleManualTransition } from './handlers/manualHandler';

export type RunMode = 'continue' | 'clean';

export async function runCommand(
  cwd: string,
  mode: RunMode = 'continue',
  vars: Record<string, string> = {},
  workflowPath?: string,
) {
  const railiDir = path.join(cwd, '.raili');
  if (!fs.existsSync(railiDir)) {
    throw new Error('.raili/ directory not found. Run `raili init` first.');
  }
  const railiStat = fs.statSync(railiDir);
  const railiIsDirectory =
    typeof (railiStat as any).isDirectory === 'function'
      ? (railiStat as any).isDirectory()
      : Boolean((railiStat as any).isDirectory);
  if (!railiIsDirectory) {
    throw new Error('.raili/ directory not found. Run `raili init` first.');
  }

  // Load workflow configuration from YAML (allow override via --workflow flag)
  const workflowConfig = loadWorkflowConfig(cwd, workflowPath);

  // Detect states with `skip` configured from the raw workflow config and prompt the user to confirm skipping them.
  // Use the raw workflowConfig here instead of the built state machine so unit tests that mock buildStateMachine
  // (but not loadWorkflowConfig) continue to work.
  const skipped = Object.entries(workflowConfig.states)
    .filter(([_, def]) => (def as any).skip)
    .map(([id]) => id);

  if (skipped.length > 0) {
    const list = skipped.join(', ');
    const question = `You have 'skip' enabled in the following states: [${list}]. Are you sure you want to skip these steps?`;

    // If running in non-interactive environment (no TTY) and no RAILI_MANUAL_CHOICE provided,
    // default to accepting the skip so tests and CI won't hang on a prompt.
    const hasTTY = !!(process.stdin && (process.stdin as any).isTTY);
    if (!hasTTY && !process.env.RAILI_MANUAL_CHOICE) {
      // Default to accept in non-interactive contexts
    } else {
      const result = await handleManualTransition({
        question,
        options: { PASSED: 'PROCEED', FAILED: 'CANCEL' },
      });
      if (result.chosen === 'FAILED') {
        console.log('Run cancelled: skip confirmation declined. No states executed.');
        process.exit(1);
        return;
      }
    }
  }

  // Build state machine from workflow config
  const stateMachine = buildStateMachine(workflowConfig);

  // Validate state machine structure
  validateStateMachine(stateMachine);

  const agentRegistryPath = path.join(railiDir, 'agent-registry.json');
  const scriptRegistryPath = path.join(railiDir, 'script-registry.json');

  if (!fs.existsSync(agentRegistryPath)) {
    throw new Error('agent-registry.json not found in .raili/');
  }
  if (!fs.existsSync(scriptRegistryPath)) {
    throw new Error('script-registry.json not found in .raili/');
  }

  // Validate registries and referenced files using validators (registries live at .raili root)
  const agents = validateAgentRegistry(cwd);
  const scripts = validateScriptRegistry(cwd);

  // Validate that all workflow references exist in registries (fail-fast)
  validateWorkflowReferences(workflowConfig, agents, scripts);

  // Clear persisted context for a clean run
  if (mode === 'clean') {
    clearContext(cwd, workflowPath);
  }

  // When doing a clean run, load vars file filtered to declared inputs and merge with supplied vars (flags override file)
  let initialVars = vars;
  if (mode === 'clean') {
    const declaredRaw = workflowConfig.inputs ?? [];
    const declaredNames: string[] = (declaredRaw as any[])
      .map((it: any) =>
        typeof it === 'string' ? it : it && typeof it.name === 'string' ? it.name : '',
      )
      .filter(Boolean);
    const fileVars = loadVarsFile(cwd, declaredNames, workflowPath);
    initialVars = { ...fileVars, ...vars };
  }

  // Load (or create) the execution context, then merge any supplied vars
  let context = mode === 'clean' ? initializeContext(initialVars) : loadContext(cwd, workflowPath);

  if (mode !== 'clean' && Object.keys(vars).length > 0) {
    context = { ...context, vars: { ...context.vars, ...vars } };
  }

  // Expose all vars as RAILI_VAR_* env vars for the entire process lifetime.
  // Scripts, commands, notify handlers and agent prompts can all reference them.
  const allVars = context.vars ?? {};
  for (const [key, value] of Object.entries(allVars)) {
    process.env[`RAILI_VAR_${key.toUpperCase()}`] = value;
  }

  const runStart = new Date().toISOString();

  const engine = new Engine({
    stateMachine,
    agentRegistry: agents,
    scriptRegistry: scripts,
    context,
    cwd,
    workflowArg: workflowPath,
  });

  await engine.run();

  appendRunLog(cwd, workflowPath, runStart, workflowConfig);
}
