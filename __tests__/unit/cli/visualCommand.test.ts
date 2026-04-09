jest.mock('../../../src/workflow/workflowLoader', () => ({
  loadWorkflowConfig: jest.fn(() => ({ initial: 'start', states: { start: { type: 'engine' } } })),
}));

jest.mock('../../../src/registry/registryValidator', () => ({
  validateAgentRegistry: jest.fn(() => ({})),
  validateScriptRegistry: jest.fn(() => ({})),
  validateWorkflowReferences: jest.fn(() => undefined),
}));

jest.mock('../../../src/cli/graphBuilder', () => ({
  buildGraph: jest.fn(() => ({ nodes: [], edges: [], terminals: [] })),
}));

jest.mock('../../../src/cli/mermaidRenderer', () => ({
  renderMermaid: jest.fn(() => 'graph TD\nA-->B'),
}));

jest.mock('../../../src/context/pathUtils', () => ({
  resolveWorkflowDir: jest.fn(() => '/tmp/.raili/main'),
}));

// Provide a file system factory that returns a fresh object per call. Tests will capture
// the instance used by visualCommand via the mocked getFileSystem mock results.
jest.mock('../../../src/infrastructure/fileSystemProvider', () => ({
  getFileSystem: jest.fn(() => ({
    existsSync: jest.fn(() => true),
    mkdirSync: jest.fn(),
    writeFileSync: jest.fn(),
    statSync: jest.fn(() => ({ isDirectory: () => true })),
  })),
}));

import { visualCommand } from '../../../src/cli/visual';
import { getFileSystem } from '../../../src/infrastructure/fileSystemProvider';

describe('visualCommand', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('prints mermaid to stdout when outPath is "-"', () => {
    const spy = jest.spyOn(console, 'log').mockImplementation(() => {});
    visualCommand(process.cwd(), 'main', 'mermaid', '-');
    expect(spy).toHaveBeenCalledWith('graph TD\nA-->B');
    spy.mockRestore();
  });

  test('writes .mmd file when outPath ends with .mmd', () => {
    // visualCommand calls getFileSystem() internally; capture the instance it used
    visualCommand(process.cwd(), 'main', 'mermaid', '/tmp/out.mmd');
    const fs = (getFileSystem as jest.Mock).mock.results[0].value;
    expect(fs.writeFileSync).toHaveBeenCalledWith('/tmp/out.mmd', 'graph TD\nA-->B');
  });

  test('writes HTML file by default when outPath is not provided', () => {
    visualCommand(process.cwd(), 'main', 'mermaid', undefined);
    const fs = (getFileSystem as jest.Mock).mock.results[0].value;
    // Last call's data should contain an HTML document
    const calls = (fs.writeFileSync as jest.Mock).mock.calls;
    expect(calls.length).toBeGreaterThan(0);
    const lastData = calls[calls.length - 1][1] as string;
    expect(lastData).toContain('<html');
    expect(lastData).toContain('graph TD');
  });
});
