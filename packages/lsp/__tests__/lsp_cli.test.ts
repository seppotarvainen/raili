import { runFromStdio } from '../src/lsp_index';

describe('src/lsp_index runFromStdio', () => {
  test('runFromStdio accepts a connectionFactory and publishes diagnostics on open', () => {
    const sendDiagnostics = jest.fn();
    let onDidOpen: any = null;

    const factory = () =>
      ({
        onInitialize: jest.fn(),
        onDidOpenTextDocument: (h: any) => {
          onDidOpen = h;
        },
        onDidChangeTextDocument: jest.fn(),
        onDefinition: jest.fn(),
        onReferences: jest.fn(),
        onHover: jest.fn(),
        onRenameRequest: jest.fn(),
        sendDiagnostics,
      }) as any;

    const server = runFromStdio(factory);
    expect(server).toBeDefined();

    const text = `initial: start
states:
  start:
    transitions:
      approve: missingState
`;

    expect(onDidOpen).not.toBeNull();
    onDidOpen!({ textDocument: { uri: 'file://cli.yaml', text } });

    expect(sendDiagnostics).toHaveBeenCalled();
  });
});
