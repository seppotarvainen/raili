import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { StateDef } from '../types';
import type { StateResult } from './runner';
import { AgentRegistry } from '../registry/agentRegistry';
import { ScriptRegistry } from '../registry/scriptRegistry';
import { runAgentState } from './agentStateRunner';
import { runScriptState } from './scriptStateRunner';
import { runCommandState } from './commandStateRunner';
import { runApprovalStep } from './approveStateRunner';
import { loadContext, addStateToHistory, saveContext } from '../context/context';
import { resolveWorkflowDir } from '../context/pathUtils';

/**
 * Execute a group state by loading its sub-workflow YAML and running its sub-states
 * sequentially. Sub-state ids are prefixed with the group state's id when persisted
 * (e.g. parent.sub1). Returns the outcome extracted from the terminal sub-state and
 * merged exports from all sub-states.
 */
export async function runGroupState(
  state: StateDef,
  cwd: string,
  vars?: Record<string, string>,
  workflowArg?: string,
  agentRegistry?: AgentRegistry,
  scriptRegistry?: ScriptRegistry,
): Promise<StateResult> {
  const cfg: any = state.config;
  if (!cfg || typeof cfg.group !== 'string') {
    throw new Error(`State '${state.id}': group state missing 'group' property`);
  }

  const workflowDir = resolveWorkflowDir(cwd, workflowArg);
  const subPath = path.resolve(workflowDir, cfg.group);
  if (!fs.existsSync(subPath)) {
    throw new Error(`Group sub-workflow not found: ${subPath}`);
  }

  const raw = fs.readFileSync(subPath, 'utf8');
  const parsed = yaml.load(raw) as any;
  if (!parsed || typeof parsed !== 'object' || !parsed.states) {
    throw new Error(`Invalid sub-workflow file: ${subPath}`);
  }

  const subStates = parsed.states as Record<string, any>;
  const entries = Object.keys(subStates);
  if (entries.length === 0) {
    throw new Error(`Sub-workflow '${subPath}' contains no states`);
  }

  // Load and mutate persisted context so sub-state entries are recorded
  let ctx = loadContext(cwd, workflowArg);

  const mergedExports: Record<string, string> = {};
  let finalOutcome = 'PASSED';

  for (const subId of entries) {
    const subCfgRaw = subStates[subId] as any;
    // clone config
    const subCfg: any = Object.assign({}, subCfgRaw);

    // If sub-state is an out:true, inherit parent's routing (on/transitions)
    if (subCfg.out === true) {
      if (cfg.on) subCfg.on = Object.assign({}, cfg.on);
      if (cfg.transitions) subCfg.transitions = Object.assign({}, cfg.transitions);
    }

    const virtualId = `${state.id}.${subId}`;
    const subState: StateDef = { id: virtualId, config: subCfg, transitions: [] } as any;

    // Record sub-state entry in context history
    ctx = addStateToHistory(ctx, virtualId);
    saveContext(cwd, ctx, workflowArg);

    // Dispatch to appropriate runner
    let res: StateResult | null = null;
    if (subCfg.type === 'agent') {
      if (!agentRegistry) throw new Error('Agent registry is required to run agent sub-states');
      res = await runAgentState(subState, agentRegistry, cwd, vars, workflowArg);
    } else if (subCfg.type === 'script') {
      if (!scriptRegistry) throw new Error('Script registry is required to run script sub-states');
      res = await runScriptState(subState, scriptRegistry, cwd, vars, workflowArg);
    } else if (subCfg.type === 'command') {
      res = await runCommandState(subState, cwd, vars, workflowArg);
    } else if (subCfg.type === 'engine') {
      // engine states are no-op and treated as PASSED
      res = { outcome: 'PASSED' };
    } else if (subCfg.approval) {
      // Approval requires manual prompt; call runApprovalStep without full runner context
      const out = await runApprovalStep(virtualId, subCfg.approval, { cwd });
      res = { outcome: out.chosen } as StateResult;
    } else {
      // Unknown or unsupported state type inside sub-workflow
      throw new Error(`Unsupported sub-state type '${subCfg.type}' in '${subPath}'`);
    }

    // Merge exports
    if (res.exports) {
      for (const [k, v] of Object.entries(res.exports)) mergedExports[k] = String(v);
    }

    // If this sub-state is marked out:true, stop and return its outcome
    if (subCfg.out === true) {
      finalOutcome = res.outcome;
      break;
    }
  }

  return { outcome: finalOutcome, exports: mergedExports };
}
