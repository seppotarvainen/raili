import { Graph, GraphNode } from '../types';

const typeColorMap: Record<string, string> = {
  agent: '#87CEEB', // light blue
  script: '#90EE90', // light green
  command: '#FFA500', // orange
  engine: '#D3D3D3', // light gray
  group: '#D8BFD8', // thistle
};

function nodeLabel(node: GraphNode): string {
  // Use HTML-style break for Mermaid labels
  const title = node.id;
  const type = node.type;
  return `${title}<br/>${type}`;
}

export function renderMermaid(graph: Graph): string {
  const lines: string[] = [];
  lines.push('graph TD');

  // Initial arrow: prefer graph.initial, fallback to first node
  const initialTarget = graph.initial ?? (graph.nodes.length ? graph.nodes[0].id : undefined);
  if (initialTarget) {
    lines.push(`[*] -->|initial| ${initialTarget}`);
  }

  // Node definitions
  for (const node of graph.nodes) {
    const label = nodeLabel(node);
    const isTerminal = graph.terminals.includes(node.id);
    if (isTerminal) {
      // double-circle / triple paren notation
      // Mermaid terminal node: (((id))) — include label inside for readability
      lines.push(`${node.id}((( ${label} )))`);
    } else {
      // rectangular node with label
      lines.push(`${node.id}["${label}"]`);
    }
  }

  // Edges
  for (const edge of graph.edges) {
    const arrow = edge.isDefault ? '-.->' : '-->';
    const label = edge.outcome ? `|${edge.outcome}|` : '';
    lines.push(`${edge.from} ${arrow}${label} ${edge.to}`);
  }

  // Style lines
  for (const node of graph.nodes) {
    const color = typeColorMap[node.type] || '#FFFFFF';
    lines.push(`style ${node.id} fill:${color},stroke:#333,stroke-width:1px`);
  }

  // Notes for annotations: max_visits & output.store
  for (const node of graph.nodes) {
    const parts: string[] = [];
    const mv = node.config?.max_visits;
    if (mv && typeof mv.count === 'number') {
      parts.push(`max_visits=${mv.count}`);
    }
    if (node.config?.output && node.config.output.store) {
      parts.push('output.store=true');
    }
    if (parts.length > 0) {
      const note = parts.join(', ');
      lines.push(`Note over ${node.id}: ${note}`);
    }
  }

  return lines.join('\n');
}
