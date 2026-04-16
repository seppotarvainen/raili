import { WorkflowDocument } from './lsp_workflowDocument';
import { Position } from './lsp_types';

export type TextEdit = {
  range: {
    start: { line: number; character: number };
    end: { line: number; character: number };
  };
  newText: string;
};

export function computeRenameEdits(
  doc: WorkflowDocument,
  pos: Position,
  newName: string,
): TextEdit[] | null {
  const entry = doc.findAtPosition(pos.line, pos.column);
  if (!entry) return null;
  const oldName = entry.name;
  const edits: TextEdit[] = [];

  function toLspRange(loc: Position) {
    return {
      start: { line: loc.line - 1, character: loc.column - 1 },
      end: { line: loc.line - 1, character: loc.column - 1 + oldName.length },
    };
  }

  // Replace definition
  const def = doc.states().find((s) => s.name === oldName);
  if (def) {
    edits.push({ range: toLspRange(def.location), newText: newName });
  }

  // Replace all routing references
  for (const r of doc.stateReferences()) {
    if (r.name === oldName) {
      edits.push({ range: toLspRange(r.location), newText: newName });
    }
  }

  return edits;
}
