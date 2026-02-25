/// <reference types="node" />
import * as fs from 'fs';
import * as path from 'path';
import { loadWorkflowConfig, buildStateMachine, validateStateMachine } from './workflowLoader';
import { validateAgentRegistry, validateScriptRegistry, validateWorkflowReferences } from "./registryValidator";
import { loadContext } from './context';
import { Engine } from './engine/Engine';

export async function runCommand(cwd: string) {
  const railiDir = path.join(cwd, '.raili');
  if (!fs.existsSync(railiDir) || !fs.statSync(railiDir).isDirectory()) {
    throw new Error('.raili/ directory not found. Run `raili init` first.');
  }

  // Load workflow configuration from YAML
  const workflowConfig = loadWorkflowConfig(cwd);

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

  // Validate registries and referenced files using validators
  const agents = validateAgentRegistry(cwd);
  const scripts = validateScriptRegistry(cwd);

  // Validate that all workflow references exist in registries (fail-fast)
  validateWorkflowReferences(workflowConfig, agents, scripts);

  // Load execution context
  const context = loadContext(cwd);

  const engine = new Engine({
    stateMachine,
    agentRegistry: agents,
    scriptRegistry: scripts,
    context,
    cwd,
  });

  await engine.run();
}
