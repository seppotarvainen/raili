import { WorkflowDocument } from './lsp_workflowDocument';
import { Position, StateDef } from './lsp_types';

export interface LSPLocation {
  uri?: string;
  range: {
    start: { line: number; character: number };
    end: { line: number; character: number };
  };
}

export function gotoDefinition(doc: WorkflowDocument, pos: Position): LSPLocation | null {
  const entry = doc.findAtPosition(pos.line, pos.column);
  if (!entry) return null;

  const name = entry.name;
  const def = doc.states().find((s) => s.name === name);
  if (!def) return null;

  // Return a location with 0-indexed lines for LSP
  return {
    range: {
      start: { line: def.location.line - 1, character: def.location.column - 1 },
      end: { line: def.location.line - 1, character: def.location.column - 1 + name.length },
    },
  };
}
