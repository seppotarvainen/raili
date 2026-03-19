import fs from 'fs';
import { loadAgentRegistry, AgentRegistry } from './agentRegistry';
import { loadScriptRegistry, ScriptRegistry } from './scriptRegistry';
import { WorkflowConfig } from './types';
import { resolveRegistryPath } from './pathUtils';

export function validateAgentRegistry(dir: string): AgentRegistry {
  const reg = loadAgentRegistry(dir);
  // ensure each referenced file exists and is a regular file
  for (const [id, entry] of Object.entries(reg)) {
    const full = resolveRegistryPath(dir, entry.path);
    if (!fs.existsSync(full)) throw new Error(`Agent '${id}' references missing file: ${full}`);
    const stat = fs.statSync(full);
    if (!stat.isFile())
      throw new Error(`Agent '${id}' references a path that is not a file: ${full}`);
  }
  return reg;
}

export function validateScriptRegistry(dir: string): ScriptRegistry {
  const reg = loadScriptRegistry(dir);
  for (const [id, entry] of Object.entries(reg)) {
    const full = resolveRegistryPath(dir, entry.path);
    if (!fs.existsSync(full)) throw new Error(`Script '${id}' references missing file: ${full}`);
    const stat = fs.statSync(full);
    if (!stat.isFile())
      throw new Error(`Script '${id}' references a path that is not a file: ${full}`);
  }
  return reg;
}

/**
 * Validate that all agents and scripts referenced in workflow.yaml
 * are defined in their respective registries and files exist.
 * This ensures fail-fast behavior before workflow execution starts.
 */
export function validateWorkflowReferences(
  workflow: WorkflowConfig,
  agents: AgentRegistry,
  scripts: ScriptRegistry,
): void {
  const missingAgents: string[] = [];
  const missingScripts: string[] = [];

  for (const [stateName, stateConfig] of Object.entries(workflow.states)) {
    // Check agent states
    if (stateConfig.type === 'agent' && stateConfig.agent) {
      if (!(stateConfig.agent in agents)) {
        missingAgents.push(
          `State '${stateName}' references agent '${stateConfig.agent}' which is not defined in agent-registry.json`,
        );
      }
    }

    // Check script states
    if (stateConfig.type === 'script' && stateConfig.script) {
      if (!(stateConfig.script in scripts)) {
        missingScripts.push(
          `State '${stateName}' references script '${stateConfig.script}' which is not defined in script-registry.json`,
        );
      }
    }
  }

  // Build comprehensive error message
  const errors: string[] = [];

  if (missingAgents.length > 0) {
    errors.push('Missing agent definitions:', ...missingAgents.map((e) => `  - ${e}`));
  }

  if (missingScripts.length > 0) {
    errors.push('Missing script definitions:', ...missingScripts.map((e) => `  - ${e}`));
  }

  if (errors.length > 0) {
    throw new Error(
      'Workflow validation failed:\n' +
        errors.join('\n') +
        '\n\nPlease ensure all referenced agents and scripts are defined in their registries and files exist.',
    );
  }
}
