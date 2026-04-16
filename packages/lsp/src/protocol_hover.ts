import { WorkflowDocument } from './lsp_workflowDocument';
import { Position } from './lsp_types';

export function hover(doc: WorkflowDocument, pos: Position): { contents: string } | null {
  const entry = doc.findAtPosition(pos.line, pos.column);
  if (!entry) return null;
  const name = entry.name;
  const def = doc.states().find((s) => s.name === name);
  if (!def) return null;

  const refs = doc.stateReferences().filter((r) => r.name === name);
  const contexts = Array.from(new Set(refs.map((r) => r.context))).filter(Boolean);

  let md = `**${name}**${def.type ? ` (${def.type} state)` : ''}\n\n`;
  md += `Type: ${def.type || 'unknown'}\n\n`;
  md += `Routing: ${contexts.length ? contexts.join(', ') : 'none'}\n\n`;
  md += `References: ${refs.length}\n`;
  return { contents: md };
}
