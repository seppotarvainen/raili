import { parseWorkflow } from './lsp_workflowParser';
import { WorkflowDocument } from './lsp_workflowDocument';
import { mapDiagnostics, ValidatorError, Diagnostic } from './protocol_diagnostics';
import { gotoDefinition } from './protocol_definition';
import { findReferences } from './protocol_references';
import { hover } from './protocol_hover';
import { computeRenameEdits } from './protocol_rename';
import { Position } from './lsp_types';

// LSP positions use {line, character} (0-indexed), internal uses {line, column} (1-indexed)
type AnyPosition = { line: number; character?: number; column?: number };

function toInternalPosition(pos: AnyPosition): Position {
  // If 'column' exists, assume already internal format
  if (pos.column !== undefined) return { line: pos.line, column: pos.column };
  // Otherwise convert from LSP 0-indexed {line, character} to 1-indexed {line, column}
  return { line: pos.line + 1, column: (pos.character ?? 0) + 1 };
}

export type LspConnectionLike = {
  onInitialize?: (handler: (params: unknown) => void) => void;
  onDidOpenTextDocument: (handler: (params: { textDocument: { uri: string; text: string } }) => void) => void;
  onDidChangeTextDocument: (handler: (params: { textDocument: { uri: string; text: string } }) => void) => void;
  onDefinition: (handler: (params: { textDocument: { uri: string }; position: AnyPosition }) => unknown) => void;
  onReferences: (handler: (params: { textDocument: { uri: string }; position: AnyPosition }) => unknown) => void;
  onHover: (handler: (params: { textDocument: { uri: string }; position: AnyPosition }) => unknown) => void;
  onRenameRequest: (handler: (params: { textDocument: { uri: string }; position: AnyPosition; newName: string }) => unknown) => void;
  sendDiagnostics: (uri: string, diags: Diagnostic[]) => void;
};

export function createServer(connection: LspConnectionLike) {
  const docs = new Map<string, WorkflowDocument>();

  function processDocument(uri: string, text: string) {
    const parsed = parseWorkflow(text);
    const doc = new WorkflowDocument(parsed);
    docs.set(uri, doc);

    // Very small validator: undefined state references -> error
    const states = new Set(doc.states().map((s) => s.name));
    const errors: ValidatorError[] = [];
    for (const r of doc.stateReferences()) {
      if (!states.has(r.name)) {
        errors.push({ message: `State '${r.name}' not found`, severity: 'error', location: r.location });
      }
    }

    const diags = mapDiagnostics(errors);
    connection.sendDiagnostics(uri, diags);
  }

  if (connection.onInitialize) {
    connection.onInitialize(() => ({ capabilities: {} }));
  }

  connection.onDidOpenTextDocument((params) => {
    processDocument(params.textDocument.uri, params.textDocument.text);
  });

  connection.onDidChangeTextDocument((params) => {
    processDocument(params.textDocument.uri, params.textDocument.text);
  });

  connection.onDefinition((params) => {
    const doc = docs.get(params.textDocument.uri);
    if (!doc) return null;
    return gotoDefinition(doc, toInternalPosition(params.position));
  });

  connection.onReferences((params) => {
    const doc = docs.get(params.textDocument.uri);
    if (!doc) return [];
    return findReferences(doc, toInternalPosition(params.position));
  });

  connection.onHover((params) => {
    const doc = docs.get(params.textDocument.uri);
    if (!doc) return null;
    return hover(doc, toInternalPosition(params.position));
  });

  connection.onRenameRequest((params) => {
    const doc = docs.get(params.textDocument.uri);
    if (!doc) return null;
    return computeRenameEdits(doc, toInternalPosition(params.position), params.newName);
  });

  return { processDocument };
}
