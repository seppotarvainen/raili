import { getFileSystem } from '../infrastructure/fileSystemProvider';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { StateDef, StateMachine, WorkflowConfig, StateConfig, InputDef } from '../types';
import { validateWorkflowConfig } from './schemaValidator';
import { resolveWorkflowDir } from '../context/pathUtils';

function loadYamlFile(filePath: string, isSubWorkflow: boolean): any {
  const fs = getFileSystem();
  if (!fs.existsSync(filePath)) {
    throw new Error(`Workflow file not found: ${filePath}`);
  }

  const content = fs.readFileSync(filePath, 'utf8');
  const parsed = yaml.load(content) as any;

  if (!parsed || typeof parsed !== 'object') {
    throw new Error(`Workflow file is empty or invalid: ${filePath}`);
  }

  if (isSubWorkflow && parsed.initial) {
    throw new Error(`Sub-workflow file must not define 'initial': ${filePath}`);
  }

  if (!parsed.states || typeof parsed.states !== 'object') {
    throw new Error(`Workflow file must define 'states' object: ${filePath}`);
  }

  return parsed;
}

function normalizeInputs(raw: any[] | undefined): InputDef[] | undefined {
  if (raw === undefined) {
    return undefined;
  }
  if (!Array.isArray(raw)) {
    throw new Error('Field "inputs" must be an array');
  }
  return raw.map((it: any, idx: number) => {
    if (typeof it === 'string') {
      return { name: it, log: false };
    }
    if (typeof it === 'object' && it !== null) {
      if (typeof it.name !== 'string') {
        throw new Error(`inputs[${idx}].name must be a string`);
      }
      if (
        'description' in it &&
        it.description !== undefined &&
        typeof it.description !== 'string'
      ) {
        throw new Error(`inputs[${idx}].description must be a string when provided`);
      }
      if ('log' in it && typeof it.log !== 'boolean') {
        throw new Error(`inputs[${idx}].log must be a boolean when provided`);
      }
      const res: any = { name: it.name, log: typeof it.log === 'boolean' ? it.log : false };
      if (typeof it.description === 'string') {
        res.description = it.description;
      }
      return res as InputDef;
    }
    throw new Error(
      `Invalid input declaration at index ${idx}: inputs must be strings or objects with 'name'`,
    );
  });
}

export function loadWorkflowConfig(cwd: string, workflowPath?: string): WorkflowConfig {
  const fs = getFileSystem();
  const workflowDir = resolveWorkflowDir(cwd, workflowPath);
  const resolvedPath = path.join(workflowDir, 'workflow.yaml');
  const main = loadYamlFile(resolvedPath, false);

  // initial schema validation of main so basic mistakes surface early
  validateWorkflowConfig(main);

  // normalize parent inputs
  let normalizedInputs = normalizeInputs(main.inputs) || undefined;

  // Work on a shallow copy of states to allow merging
  const parentStates: Record<string, StateConfig> = Object.assign({}, main.states);

  // Track IDs of group-proxy states created by flattening, so we can mark them after schema validation.
  const groupProxyIds = new Set<string>();

  // Process group states by flattening referenced sub-workflows into parent
  for (const [stateId, stateCfg] of Object.entries(Object.assign({}, parentStates))) {
    if (stateCfg && (stateCfg as any).type === 'group') {
      if (!stateCfg.group || typeof stateCfg.group !== 'string') {
        throw new Error(`Group state '${stateId}' must have a string 'group' property`);
      }

      // Resolve sub-workflow path relative to parent workflow dir
      const subPath = path.resolve(workflowDir, stateCfg.group);
      // If sub-workflow file doesn't exist, defer validation to validateWorkflowNesting
      // and leave the group state intact for later checks.
      if (!fs.existsSync(subPath)) {
        continue;
      }
      const sub = loadYamlFile(subPath, true);

      // Sub-workflow must not contain nested group states
      for (const [subId, subCfg] of Object.entries(sub.states || {})) {
        if (subCfg && (subCfg as any).type === 'group') {
          throw new Error(`Sub-workflow '${subPath}' must not contain 'group' states`);
        }
      }

      // Normalize and merge sub inputs; detect duplicates
      const subInputs = normalizeInputs(sub.inputs) || undefined;
      if (subInputs) {
        for (const si of subInputs) {
          if (normalizedInputs?.some((i) => i.name === si.name)) {
            throw new Error(
              `Duplicate input key '${si.name}' found in sub-workflow '${subPath}' and parent workflow`,
            );
          }
        }
        normalizedInputs = (normalizedInputs || []).concat(subInputs);
      }

      const outStates = Object.entries(sub.states || {})
        .filter(([_id, cfg]) => (cfg as any).out === true)
        .map(([id]) => id);
      if (outStates.length === 0) {
        throw new Error(`Sub-workflow '${subPath}' must declare at least one 'out: true'`);
      }

      // Flatten sub states into parentStates with deterministic prefix
      const subStateIdSet = new Set(Object.keys(sub.states || {}));
      const newStates: Record<string, StateConfig> = {};
      for (const [subId, subCfg] of Object.entries(sub.states || {})) {
        const newId = `${stateId}.${subId}`;
        if (parentStates[newId]) {
          throw new Error(
            `State id collision when flattening '${subPath}': '${newId}' already exists in parent workflow`,
          );
        }
        // Clone subCfg shallowly
        const cfgCopy: any = Object.assign({}, subCfg);

        // If this sub-state is marked as out:true, it must not define any routing of its own.
        if ((subCfg as any).out === true) {
          if (
            (subCfg as any).on ||
            (subCfg as any).transitions ||
            (subCfg as any).approval ||
            (subCfg as any).skip ||
            (subCfg as any).max_visits
          ) {
            throw new Error(
              `Invalid sub-state '${subId}' in '${subPath}': 'out: true' states must not define routing (on/transitions/approval/skip/max_visits)`,
            );
          }
          // Inherit parent's routing onto the sub-state so the sub-workflow can signal back into the parent.
          if ((stateCfg as any).on) {
            cfgCopy.on = Object.assign({}, (stateCfg as any).on);
          }
          if ((stateCfg as any).transitions) {
            cfgCopy.transitions = Object.assign({}, (stateCfg as any).transitions);
          }
          if ((stateCfg as any).approval) {
            cfgCopy.approval = Object.assign({}, (stateCfg as any).approval);
          }
        } else {
          // For non-out sub-states, rewrite transition targets that reference other sub-states
          // to their fully-qualified (prefixed) names so the flat state machine validates correctly.
          if (cfgCopy.on) {
            const rewrote: Record<string, string> = {};
            for (const [k, v] of Object.entries(cfgCopy.on as Record<string, string>)) {
              rewrote[k] = subStateIdSet.has(v) ? `${stateId}.${v}` : v;
            }
            cfgCopy.on = rewrote;
          }
          if (cfgCopy.transitions) {
            const rewrote: Record<string, string> = {};
            for (const [k, v] of Object.entries(cfgCopy.transitions as Record<string, string>)) {
              rewrote[k] = subStateIdSet.has(v) ? `${stateId}.${v}` : v;
            }
            cfgCopy.transitions = rewrote;
          }
        }

        newStates[newId] = cfgCopy as StateConfig;
      }

      // Determine entry state for sub-workflow: pick first declared state in sub.states
      const subStateKeys = Object.keys(sub.states || {});
      if (subStateKeys.length === 0) {
        throw new Error(`Sub-workflow '${subPath}' contains no states`);
      }
      const entry = `${stateId}.${subStateKeys[0]}`;

      // Replace the group state in parent with a proxy engine state that skips to the flattened entry.
      parentStates[stateId] = { type: 'engine', skip: entry } as any;
      groupProxyIds.add(stateId);

      // Merge flattened states into parentStates
      for (const [k, v] of Object.entries(newStates)) {
        parentStates[k] = v;
      }
    }
  }

  const config: WorkflowConfig = {
    initial: main.initial,
    states: parentStates,
    inputs: normalizedInputs,
  };
  if (main.error) {
    config.error = main.error;
  }

  // Final validation of merged config
  validateWorkflowConfig(config);

  // After validation, tag group-proxy states with an internal marker.
  // This is intentionally post-validation so the schema validator does not see it.
  // run.ts uses this flag to skip the user-facing skip-confirmation prompt for internal proxies.
  for (const proxyId of groupProxyIds) {
    (parentStates[proxyId] as any)._groupProxy = true;
  }

  return config;
}

/**
 * Convert workflow config into a runtime state machine with explicit transitions
 */
export function buildStateMachine(config: WorkflowConfig): StateMachine {
  const states: Record<string, StateDef> = {};

  // First pass: create state definitions
  for (const [stateId, stateConfig] of Object.entries(config.states)) {
    const transitions: string[] = [];

    // Collect transitions from 'on' property (PASSED, FAILED, etc.)
    if (stateConfig.on) {
      for (const target of Object.values(stateConfig.on)) {
        if (!transitions.includes(target)) {
          transitions.push(target);
        }
      }
    }

    // Collect transitions from 'transitions' property (conditional routing)
    if (stateConfig.transitions) {
      for (const target of Object.values(stateConfig.transitions)) {
        if (!transitions.includes(target)) {
          transitions.push(target);
        }
      }
    }

    // If state has approval, add those transitions
    if (stateConfig.approval) {
      if (!transitions.includes(stateConfig.approval.PASSED)) {
        transitions.push(stateConfig.approval.PASSED);
      }
      if (!transitions.includes(stateConfig.approval.FAILED)) {
        transitions.push(stateConfig.approval.FAILED);
      }
    }

    // If state defines a skip target, include it in the transition set so validation can verify the target exists
    if ((stateConfig as any).skip) {
      const s = (stateConfig as any).skip as string;
      if (!transitions.includes(s)) {
        transitions.push(s);
      }
    }

    // If state defines max_visits with a continue target, include it so validation can verify the target exists
    if ((stateConfig as any).max_visits && typeof (stateConfig as any).max_visits === 'object') {
      const cont = (stateConfig as any).max_visits.continue as string | undefined;
      if (cont && !transitions.includes(cont)) {
        transitions.push(cont);
      }
    }

    states[stateId] = {
      id: stateId,
      config: stateConfig,
      transitions,
    };
  }

  const machine: StateMachine = {
    initial: config.initial,
    states,
  };

  if (config.error) {
    machine.error = config.error;
  }

  return machine;
}

/**
 * Validate state machine structure and transitions
 */
export function validateStateMachine(machine: StateMachine): void {
  if (!machine) {
    throw new Error('State machine is undefined');
  }

  if (typeof machine.initial !== 'string' || !(machine.initial in machine.states)) {
    throw new Error(
      `Invalid state machine: initial state '${machine.initial}' not defined in states`,
    );
  }

  const stateKeys = new Set(Object.keys(machine.states));

  for (const [id, def] of Object.entries(machine.states)) {
    if (def?.id !== id) {
      throw new Error(`Invalid state definition for '${id}': id mismatch`);
    }

    if (!Array.isArray(def.transitions)) {
      throw new Error(`Invalid state definition for '${id}': transitions must be an array`);
    }

    // Validate all transitions point to existing states
    for (const t of def.transitions) {
      if (!stateKeys.has(t)) {
        throw new Error(
          `Invalid state machine: state '${id}' has transition to unknown state '${t}'`,
        );
      }
    }

    // Validate state config
    const config = def.config;
    if (!config.type || !['agent', 'script', 'command', 'engine', 'group'].includes(config.type)) {
      throw new Error(
        `Invalid state '${id}': type must be 'agent', 'script', 'command', 'engine', or 'group'`,
      );
    }

    if (config.on && config.transitions) {
      throw new Error(
        `Invalid state '${id}': cannot have both 'on' and 'transitions' — use 'on' for binary PASSED/FAILED outcomes, 'transitions' for named outcomes`,
      );
    }

    if (config.type === 'agent' && !config.agent) {
      throw new Error(`Invalid state '${id}': agent type requires 'agent' property`);
    }

    if (config.type === 'script' && !config.script) {
      throw new Error(`Invalid state '${id}': script type requires 'script' property`);
    }

    if (config.type === 'command' && !config.command) {
      throw new Error(`Invalid state '${id}': command type requires 'command' property`);
    }

    if (
      config.type === 'group' &&
      (!('group' in config) || typeof (config as any).group !== 'string')
    ) {
      throw new Error(
        `Invalid state '${id}': group type requires 'group' property pointing to sub-workflow YAML`,
      );
    }

    // Basic validation for teach entries shape (must be a mapping agentId -> array of sources)
    if ((config as any).teach !== undefined) {
      const teach = (config as any).teach;
      if (teach === null || typeof teach !== 'object' || Array.isArray(teach)) {
        throw new Error(`Invalid state '${id}': teach must be a mapping of agentId -> array`);
      }
      for (const [agentId, arr] of Object.entries(teach)) {
        if (!Array.isArray(arr)) {
          throw new Error(`Invalid state '${id}': teach['${agentId}'] must be an array`);
        }
        for (const entry of arr as any[]) {
          if (typeof entry !== 'object' || entry === null) {
            throw new Error(`Invalid state '${id}': teach entries must be objects`);
          }
          const keys = Object.keys(entry);
          if (keys.length !== 1 || !['output', 'var'].includes(keys[0])) {
            throw new Error(
              `Invalid state '${id}': teach entries must be of form {output: <stateId>} or {var: "{VAR}"}`,
            );
          }
        }
      }
    }
  }

  // Cross-state validation: ensure teach output references exist and have output.store=true, and var refs are well-formed
  for (const [id, def] of Object.entries(machine.states)) {
    const cfg = def.config as any;
    if (!cfg.teach) {
      continue;
    }
    const teach = cfg.teach as Record<string, any[]>;
    for (const [_agentId, arr] of Object.entries(teach)) {
      if (!Array.isArray(arr)) {
        continue;
      }
      for (const entry of arr) {
        if ((entry as any).output) {
          const ref = (entry as any).output as string;
          if (!stateKeys.has(ref)) {
            throw new Error(
              `Invalid state '${id}': teach references unknown state '${ref}' via output:${ref}`,
            );
          }
          const refCfg = machine.states[ref].config;
          if (!refCfg.output?.store) {
            throw new Error(
              `Invalid state '${id}': teach output reference '${ref}' must have output.store: true`,
            );
          }
        }
        if ((entry as any).var) {
          const raw = (entry as any).var as string;
          const varPattern = /^\$\{([A-Za-z_][A-Za-z0-9_]*)\}$/;
          if (!varPattern.test(raw)) {
            throw new Error(
              `Invalid state '${id}': teach var entry '${raw}' must be in the form \${VAR_NAME} `,
            );
          }
        }
      }
    }
  }

  // Validate declared error state exists in machine and is terminal
  if (machine.error) {
    if (!(machine.error in machine.states)) {
      throw new Error(
        `Invalid state machine: declared error state '${machine.error}' not found in states`,
      );
    }
    const errDef = machine.states[machine.error];
    if (errDef.transitions.length > 0) {
      throw new Error(
        `Invalid state machine: error state '${machine.error}' must be terminal and have no transitions`,
      );
    }
  }
}
