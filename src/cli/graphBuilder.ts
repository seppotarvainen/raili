import { WorkflowConfig, GraphNode, GraphEdge, Graph } from '../types';

export function buildGraph(config: WorkflowConfig): Graph {
  const stateIds = Object.keys(config.states);
  const nodes: GraphNode[] = stateIds.map((id) => ({
    id,
    type: config.states[id].type,
    config: config.states[id],
  }));

  const edges: GraphEdge[] = [];
  const terminals: string[] = [];

  for (const id of stateIds) {
    const cfg = config.states[id];

    const hasOn = !!cfg.on && Object.keys(cfg.on).length > 0;
    const hasTransitions = !!cfg.transitions && Object.keys(cfg.transitions).length > 0;
    const hasApproval = !!cfg.approval;
    const hasSkip = typeof cfg.skip === 'string' && cfg.skip.length > 0;
    const hasContinue = typeof cfg.continue === 'string' && cfg.continue.length > 0;

    if (!hasOn && !hasTransitions && !hasApproval && !hasSkip && !hasContinue) {
      terminals.push(id);
    }

    if (hasOn && cfg.on) {
      for (const [outcome, to] of Object.entries(cfg.on)) {
        edges.push({ from: id, to, outcome, isDefault: outcome === 'default' });
      }
    }

    if (hasTransitions && cfg.transitions) {
      for (const [outcome, to] of Object.entries(cfg.transitions)) {
        edges.push({ from: id, to, outcome, isDefault: outcome === 'default' });
      }
    }

    if (hasApproval && cfg.approval) {
      // approval defines PASSED and FAILED routing
      edges.push({ from: id, to: cfg.approval.PASSED, outcome: 'PASSED' });
      edges.push({ from: id, to: cfg.approval.FAILED, outcome: 'FAILED' });
    }

    if (hasSkip && cfg.skip) {
      edges.push({ from: id, to: cfg.skip, outcome: 'skip', isDefault: true });
    }

    if (hasContinue && cfg.continue) {
      edges.push({ from: id, to: cfg.continue, outcome: 'continue' });
    }
  }

  // Validate that all targets exist
  const stateSet = new Set(stateIds);
  const missing = new Set<string>();
  for (const e of edges) {
    if (!stateSet.has(e.to)) missing.add(e.to);
  }

  if (missing.size > 0) {
    throw new Error(`Undefined transition targets: ${[...missing].join(', ')}`);
  }

  return { initial: config.initial, nodes, edges, terminals };
}
