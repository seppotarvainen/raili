import fs from 'fs';
import { AgentRegistry, loadAgentRegistry } from './agentRegistry';
import { loadScriptRegistry, ScriptRegistry } from './scriptRegistry';
import { WorkflowConfig } from '../types';
import { resolveRegistryPath } from '../context/pathUtils';

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

  // Collect declared workflow input names for collision detection
  const declaredInputs = new Set((workflow.inputs || []).map((i) => i.name));

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

    // Validate feedback block if present
    const fb: any = (stateConfig as any).feedback;
    if (fb) {
      if (!fb.expose_var || String(fb.expose_var).trim() === '') {
        throw new Error(`State '${stateName}': feedback.expose_var must be provided and non-empty`);
      }
      if (declaredInputs.has(fb.expose_var)) {
        throw new Error(
          `State '${stateName}': feedback.expose_var '${fb.expose_var}' conflicts with declared workflow input of the same name`,
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

/**
 * Validate 'group' state nesting and sub-workflow constraints.
 * Ensures sub-workflow file exists, does not declare nested group states, does not define 'initial',
 * and contains at least one state with 'out: true'. Also ensures the main workflow does not reference
 * inner state IDs of the sub-workflow directly (must route to the group state only).
 */
export function validateWorkflowNesting(workflow: WorkflowConfig, workflowDir: string): void {
  const yaml = require('js-yaml');
  const path = require('path');

  // Collect all potential targets referenced by the main workflow so we can detect illegal cross-references
  const referencedTargets = new Set<string>();
  for (const cfg of Object.values(workflow.states)) {
    // on
    if (cfg.on) {
      for (const t of Object.values(cfg.on)) referencedTargets.add(t);
    }
    // transitions
    if (cfg.transitions) {
      for (const t of Object.values(cfg.transitions)) referencedTargets.add(t);
    }
    // approval
    if ((cfg as any).approval) {
      referencedTargets.add((cfg as any).approval.PASSED);
      referencedTargets.add((cfg as any).approval.FAILED);
    }
    // skip
    if ((cfg as any).skip) referencedTargets.add((cfg as any).skip as string);
    // max_visits.continue
    if ((cfg as any).max_visits && (cfg as any).max_visits.continue)
      referencedTargets.add((cfg as any).max_visits.continue as string);
  }

  for (const [stateName, stateConfig] of Object.entries(workflow.states)) {
    if (stateConfig.type !== 'group') continue;

    if (!('group' in stateConfig) || typeof (stateConfig as any).group !== 'string') {
      throw new Error(
        `Group state '${stateName}' must include a 'group' path to a sub-workflow YAML`,
      );
    }

    // Resolve group path relative to workflow dir, but also accept path relative to .raili (parent of workflowDir)
    const baseDir = path.resolve(workflowDir, '..');
    let groupPath = path.resolve(workflowDir, (stateConfig as any).group);
    if (!fs.existsSync(groupPath)) {
      const alt = path.resolve(baseDir, (stateConfig as any).group);
      if (!fs.existsSync(alt)) {
        throw new Error(`Group state '${stateName}' references missing sub-workflow: ${groupPath}`);
      }
      groupPath = alt;
    }

    const content = fs.readFileSync(groupPath, 'utf8');
    const parsed = yaml.load(content) as any;
    if (!parsed || typeof parsed !== 'object') {
      throw new Error(`Sub-workflow file is empty or invalid: ${groupPath}`);
    }
    if (parsed.initial) {
      throw new Error(`Sub-workflow file must not define 'initial': ${groupPath}`);
    }
    if (!parsed.states || typeof parsed.states !== 'object') {
      throw new Error(`Sub-workflow file must define 'states' object: ${groupPath}`);
    }

    const innerIds = Object.keys(parsed.states);

    // Ensure no nested group states inside the sub-workflow
    for (const [innerId, innerCfg] of Object.entries(parsed.states)) {
      const innerCfgAny: any = innerCfg;
      if (innerCfgAny && innerCfgAny.type === 'group') {
        throw new Error(
          `Sub-workflow '${groupPath}' contains nested 'group' state '${innerId}' — nesting depth > 1 not allowed`,
        );
      }
    }

    // Ensure at least one state inside sub-workflow has out: true
    const hasOut = innerIds.some((id) => parsed.states[id] && parsed.states[id].out === true);
    if (!hasOut) {
      throw new Error(
        `Sub-workflow '${groupPath}' must declare at least one state with 'out: true'.`,
      );
    }

    // Ensure main workflow does not reference inner state IDs directly
    for (const innerId of innerIds) {
      if (referencedTargets.has(innerId)) {
        throw new Error(
          `Main workflow references inner state '${innerId}' from sub-workflow '${groupPath}' directly; main workflow must route to the group state '${stateName}' only.`,
        );
      }
    }
  }
}
