import { createServer } from '../src/lsp_server';

describe('LSP server wiring', () => {
  let handlers: any;
  let connection: any;

  beforeEach(() => {
    handlers = {};
    connection = {
      onInitialize: jest.fn((cb: any) => cb && cb()),
      onDidOpenTextDocument: jest.fn((cb: any) => (handlers.didOpen = cb)),
      onDidChangeTextDocument: jest.fn((cb: any) => (handlers.didChange = cb)),
      onDefinition: jest.fn((cb: any) => (handlers.definition = cb)),
      onReferences: jest.fn((cb: any) => (handlers.references = cb)),
      onHover: jest.fn((cb: any) => (handlers.hover = cb)),
      onRenameRequest: jest.fn((cb: any) => (handlers.rename = cb)),
      sendDiagnostics: jest.fn(),
    };
  });

  test('registers handlers and publishes diagnostics on open', () => {
    createServer(connection);
    expect(connection.onDidOpenTextDocument).toHaveBeenCalled();

    const uri = 'file:///test/workflow.yaml';
    const text = `states:\n  start:\n    type: engine\n    on:\n      PASSED: missing_state\n  done:\n    type: engine\n`;

    handlers.didOpen({ textDocument: { uri, text } });

    // diagnostics should be published for missing_state
    expect(connection.sendDiagnostics).toHaveBeenCalled();
    const callArgs = connection.sendDiagnostics.mock.calls[0];
    expect(callArgs[0]).toBe(uri);
    const diags = callArgs[1];
    expect(Array.isArray(diags)).toBe(true);
    expect(diags.length).toBeGreaterThan(0);
    expect(diags[0].message).toContain('missing_state');
  });

  test('definition, references, hover, rename handlers return expected shapes', () => {
    createServer(connection);
    const uri = 'file:///test/workflow2.yaml';
    const text = `states:\n  start:\n    type: engine\n    on:\n      PASSED: done\n  done:\n    type: engine\n`;
    handlers.didOpen({ textDocument: { uri, text } });

    // Call definition at the position of the definition itself (line of 'start')
    const def = handlers.definition({ textDocument: { uri }, position: { line: 2, column: 3 } });
    expect(def).not.toBeNull();
    // Definition should return a Location object with range
    expect(def).toHaveProperty('range');
    expect(def.range).toHaveProperty('start');
    expect(def.range).toHaveProperty('end');

    const refs = handlers.references({ textDocument: { uri }, position: { line: 2, column: 3 } });
    expect(Array.isArray(refs)).toBe(true);

    const h = handlers.hover({ textDocument: { uri }, position: { line: 2, column: 3 } });
    // Hover should return { contents: string } or null
    if (h !== null) {
      expect(h).toHaveProperty('contents');
    }

    const edits = handlers.rename({
      textDocument: { uri },
      position: { line: 2, column: 3 },
      newName: 'newStart',
    });
    expect(Array.isArray(edits)).toBe(true);
  });
});

// Appended tests merged from lsp_server.test.ts (duplicate)
describe('lsp_server', () => {
  test('processDocument sends diagnostics for undefined state references', () => {
    const sendDiagnostics = jest.fn();

    let onDidOpenHandler:
      | ((params: { textDocument: { uri: string; text: string } }) => void)
      | null = null;

    const connection = {
      onInitialize: jest.fn(),
      onDidOpenTextDocument: (h: any) => {
        onDidOpenHandler = h;
      },
      onDidChangeTextDocument: jest.fn(),
      onDefinition: jest.fn(),
      onReferences: jest.fn(),
      onHover: jest.fn(),
      onRenameRequest: jest.fn(),
      sendDiagnostics,
    } as any;

    const server = createServer(connection);
    expect(server).toBeDefined();

    const text = `initial: start
states:
  start:
    transitions:
      approve: missingState
`;

    // Simulate opening the document
    expect(onDidOpenHandler).not.toBeNull();
    onDidOpenHandler!({ textDocument: { uri: 'file://test.yaml', text } });

    expect(sendDiagnostics).toHaveBeenCalled();
    const [uri, diags] = sendDiagnostics.mock.calls[0];
    expect(uri).toBe('file://test.yaml');
    expect(Array.isArray(diags)).toBe(true);
    expect(diags.length).toBeGreaterThan(0);
    // Diagnostic message should mention the missing state name
    const messages = diags.map((d: any) => d.message).join('\n');
    expect(messages).toMatch(/State 'missingState' not found/);
  });
});
