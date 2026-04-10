import * as fs from 'fs';
import * as path from 'path';
import os from 'os';
import { resolveStateOutputPath, buildEnvOverrides } from '../../../src/runner/stateRunnerUtils';

describe('stateRunnerUtils.resolveStateOutputPath', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'raili-test-'));
    // ensure .raili/main exists (resolveWorkflowDir prefers .raili/main when workflowArg is not provided)
    fs.mkdirSync(path.join(tmpDir, '.raili', 'main'), { recursive: true });
  });

  afterEach(() => {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch (e) {
      // ignore cleanup errors
    }
  });

  test('resolves output path for main workflow and simple state id', () => {
    const p = resolveStateOutputPath(tmpDir, 'start');
    const expected = path.join(tmpDir, '.raili', 'main', 'outputs', 'start.md');
    expect(p).toBe(expected);
  });

  test('uses the final segment for dotted state ids', () => {
    const p = resolveStateOutputPath(tmpDir, 'group.substate');
    const expected = path.join(tmpDir, '.raili', 'main', 'outputs', 'substate.md');
    expect(p).toBe(expected);
  });

  test('resolves output path for a named workflowArg', () => {
    const wf = 'feature';
    fs.mkdirSync(path.join(tmpDir, '.raili', wf), { recursive: true });
    const p = resolveStateOutputPath(tmpDir, 's', wf);
    const expected = path.join(tmpDir, '.raili', wf, 'outputs', 's.md');
    expect(p).toBe(expected);
  });

  test('includes workflow as RAILI_VAR_WORKFLOW', () => {
    const env = buildEnvOverrides({ workflow: 'main', ticket_id: '123' });
    expect(env.RAILI_VAR_WORKFLOW).toBe('main');
    expect(env.RAILI_VAR_TICKET_ID).toBe('123');
  });

  test('returns empty object when no vars', () => {
    expect(buildEnvOverrides()).toEqual({});
  });
});
