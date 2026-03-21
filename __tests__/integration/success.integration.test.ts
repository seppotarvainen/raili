import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {buildStateMachine, loadWorkflowConfig, validateStateMachine} from '../../src/workflow/workflowLoader';

describe('Integration: success field in terminal engine states', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'raili-test-'));
    fs.mkdirSync(path.join(tmpDir, '.raili', 'main'), { recursive: true });
  });

  afterEach(() => {
    // Clean up temp directory
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch (err) {
      // ignore
    }
  });

  it('accepts terminal engine states with success:true', () => {
    const yaml = `initial: start
states:
  start:
    type: engine
    transitions:
      next: done
  done:
    type: engine
    success: true
`;
    const wfPath = path.join(tmpDir, '.raili', 'main', 'workflow.yaml');
    fs.writeFileSync(wfPath, yaml, 'utf8');

    expect(() => {
      const cfg = loadWorkflowConfig(tmpDir);
      const machine = buildStateMachine(cfg);
      validateStateMachine(machine);
      // ensure the parsed config contains success true
      expect(machine.states['done'].config.success).toBe(true);
    }).not.toThrow();
  });
});
