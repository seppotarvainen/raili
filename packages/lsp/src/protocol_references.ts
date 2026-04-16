import { WorkflowDocument } from './lsp_workflowDocument';
import { Position } from './lsp_types';

export type ReferenceLocation = {
  kind: 'def' | 'ref';
  name: string;
  location: { line: number; column: number };
  context?: string;
  range: {
    start: { line: number; character: number };
    end: { line: number; character: number };
  };
};

function toRange(loc: Position, nameLength: number) {
  return {
    start: { line: loc.line - 1, character: loc.column - 1 },
    end: { line: loc.line - 1, character: loc.column - 1 + nameLength },
  };
}

export function findReferences(doc: WorkflowDocument, pos: Position): ReferenceLocation[] {
  const entry = doc.findAtPosition(pos.line, pos.column);
  if (!entry) return [];

  const name = entry.name;
  const results: ReferenceLocation[] = [];

  // definition
  const def = doc.states().find((s) => s.name === name);
  if (def) {
    results.push({
      kind: 'def',
      name: def.name,
      location: def.location,
      range: toRange(def.location, name.length),
    });
  }

  // all references
  for (const r of doc.stateReferences()) {
    if (r.name === name) {
      results.push({
        kind: 'ref',
        name: r.name,
        location: r.location,
        context: r.context,
        range: toRange(r.location, name.length),
      });
    }
  }

  return results;
}
