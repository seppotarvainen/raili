import path from 'path';
import { setupFakeFs } from '../infrastructure/fsFake.util';
import { getFileSystem } from '../../../src/infrastructure/fileSystemProvider';
import { loadWorkflowConfig } from '../../../src/workflow/workflowLoader';

const TMP = '/tmp';
let restoreFs: () => void;

beforeEach(() => {
  restoreFs = setupFakeFs();
});

afterEach(() => {
  restoreFs();
});

  test('loads workflow from .raili/<name>/ directory', () => {
    const devDir = path.join(TMP, '.raili', 'dev');
    getFileSystem().mkdirSync(devDir, { recursive: true } as any);
    const workflow = ['initial: init', 'states:', '  init:', "    type: engine", '  done:', '    type: engine'].join('\n');
    getFileSystem().writeFileSync(path.join(devDir, 'workflow.yaml'), workflow);

    const config = loadWorkflowConfig(TMP, 'dev');
    expect(config.initial).toBe('init');
  });

  test('throws when named workflow directory does not exist', () => {
    const railiDir = path.join(TMP, '.raili');
    getFileSystem().mkdirSync(railiDir);

    expect(() => loadWorkflowConfig(TMP, 'nonexistent')).toThrow(
      'Unable to resolve workflow directory',
    );
  });

  test('throws when workflow.yaml missing in named directory', () => {
    const devDir = path.join(TMP, '.raili', 'dev');
    getFileSystem().mkdirSync(devDir, { recursive: true } as any);

    expect(() => loadWorkflowConfig(TMP, 'dev')).toThrow('Workflow file not found');
  });
