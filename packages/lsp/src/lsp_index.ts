import {
  createConnection,
  TextDocuments,
  ProposedFeatures,
  InitializeResult,
  InitializeParams,
  Diagnostic as LSPDiagnostic,
} from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { createServer as createCoreServer, LspConnectionLike } from './lsp_server';
import { Diagnostic } from './protocol_diagnostics';

/**
 * Convert our internal Diagnostic format to LSP Diagnostic format
 * Note: Internal format uses 1-indexed lines, LSP uses 0-indexed
 */
function toLSPDiagnostic(diag: Diagnostic): LSPDiagnostic {
  return {
    range: {
      start: { line: diag.location.line - 1, character: diag.location.column - 1 },
      end: { line: diag.location.line - 1, character: diag.location.column },
    },
    message: diag.message,
    severity: diag.severity as any, // 1 = Error, 2 = Warning, 3 = Information
  };
}

export function runFromStdio(connectionFactory?: () => LspConnectionLike) {
  // Use provided connection factory for testing
  if (connectionFactory) {
    const conn = connectionFactory();
    createCoreServer(conn);
    return { processDocument: () => {} };
  }

  // Otherwise, create real connection from stdio
  const connection = createConnection(ProposedFeatures.all);
  const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);

  const conn = createVscodeAdapter(connection, documents);
  createCoreServer(conn);

  // Listen on the connection
  documents.listen(connection);
  connection.listen();

  return { processDocument: () => {} };
}

/**
 * Adapts vscode-languageserver connection to our LspConnectionLike interface
 */
function createVscodeAdapter(connection: any, documents: TextDocuments<TextDocument>): LspConnectionLike {
  const diagnosticMap = new Map<string, LSPDiagnostic[]>();

  return {
    onInitialize: (handler: (params: unknown) => void) => {
      connection.onInitialize((params: InitializeParams) => {
        const result: InitializeResult = {
          capabilities: {
            textDocumentSync: 1, // FULL
            definitionProvider: true,
            referencesProvider: true,
            hoverProvider: true,
            renameProvider: true,
          },
        };
        if (handler) handler(params);
        return result;
      });
    },
    onDidOpenTextDocument: (handler: (params: { textDocument: { uri: string; text: string } }) => void) => {
      documents.onDidOpen((event) => {
        const { uri } = event.document;
        const text = event.document.getText();
        handler({ textDocument: { uri, text } });
      });
    },
    onDidChangeTextDocument: (handler: (params: { textDocument: { uri: string; text: string } }) => void) => {
      documents.onDidChangeContent?.((event: any) => {
        const { uri } = event.document;
        const text = event.document.getText();
        handler({ textDocument: { uri, text } });
      });
    },
    onDefinition: (handler: (params: { textDocument: { uri: string }; position: any }) => unknown) => {
      connection.onDefinition((params: any) => {
        const result: any = handler(params);
        if (!result) return null;
        // Add uri to the location if not present
        return { uri: params.textDocument.uri, range: result.range };
      });
    },
    onReferences: (handler: (params: { textDocument: { uri: string }; position: any }) => unknown) => {
      connection.onReferences((params: any) => {
        const results: any[] = handler(params) as any[] || [];
        // Convert to LSP Location format
        return results.map((r: any) => ({
          uri: params.textDocument.uri,
          range: r.range,
        }));
      });
    },
    onHover: (handler: (params: { textDocument: { uri: string }; position: any }) => unknown) => {
      connection.onHover((params: any) => {
        const result: any = handler(params);
        if (!result) return null;
        return { contents: { kind: 'markdown', value: result.contents } };
      });
    },
    onRenameRequest: (handler: (params: { textDocument: { uri: string }; position: any; newName: string }) => unknown) => {
      connection.onRenameRequest((params: any) => {
        const edits: any = handler(params);
        if (!edits || !Array.isArray(edits) || edits.length === 0) return null;
        // Wrap in WorkspaceEdit
        return {
          changes: {
            [params.textDocument.uri]: edits,
          },
        };
      });
    },
    sendDiagnostics: (uri: string, diags: Diagnostic[]) => {
      const lspDiags = diags.map(toLSPDiagnostic);
      diagnosticMap.set(uri, lspDiags);
      connection.sendDiagnostics({ uri, diagnostics: lspDiags });
    },
  };
}
