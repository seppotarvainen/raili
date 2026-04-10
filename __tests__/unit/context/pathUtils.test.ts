import path from 'path';
import { getFileSystem } from '../../../src/infrastructure/fileSystemProvider';
import { setupFakeFs } from '../infrastructure/fsFake.util';
import { resolveApprovalResolverPath, resolveFeedbackResolverPath, resolveTriggerPath } from '../../../src/context/pathUtils';
import { getWorkflowName } from '../../../src/context/pathUtils';

describe('pathUtils resolver discovery', () => {
  let restoreFs: () => void;

  beforeEach(() => {
    restoreFs = setupFakeFs();
  });

  afterEach(() => {
    restoreFs();
  });

  test('returns null when resolver files are absent', () => {
    const workflowDir = path.join('/tmp/workflow', '.raili', 'main');
    const fs = getFileSystem();
    fs.mkdirSync(workflowDir, { recursive: true });

    expect(resolveApprovalResolverPath(workflowDir)).toBeNull();
    expect(resolveFeedbackResolverPath(workflowDir)).toBeNull();
  });

  test('returns absolute paths when resolver files exist', () => {
    const workflowDir = path.join('/tmp/workflow', '.raili', 'main');
    const fs = getFileSystem();
    fs.mkdirSync(workflowDir, { recursive: true });

    const approvalPath = path.join(workflowDir, 'approval-resolver.js');
    const feedbackPath = path.join(workflowDir, 'feedback-resolver.js');

    fs.writeFileSync(approvalPath, 'module.exports = () => "PASSED";');
    fs.writeFileSync(feedbackPath, 'module.exports = () => "ok";');

    expect(resolveApprovalResolverPath(workflowDir)).toBe(approvalPath);
    expect(resolveFeedbackResolverPath(workflowDir)).toBe(feedbackPath);
  });

  test('resolveTriggerPath returns path when trigger.js exists and null otherwise', () => {
    const workflowDir = path.join('/tmp/workflow', '.raili', 'main');
    const fs = getFileSystem();
    fs.mkdirSync(workflowDir, { recursive: true });

    const triggerPath = path.join(workflowDir, 'trigger.js');
    expect(resolveTriggerPath(workflowDir)).toBeNull();

    fs.writeFileSync(triggerPath, 'module.exports = async () => ({ok:true});');
    expect(resolveTriggerPath(workflowDir)).toBe(triggerPath);
  });
});

describe('getWorkflowName', () => {
  let restore: () => void;
  beforeEach(() => {
    restore = setupFakeFs();
  });
  afterEach(() => restore());

  test('returns main when no workflowArg', () => {
    const fs = getFileSystem();
    fs.mkdirSync('/proj', { recursive: true } as any);
    fs.mkdirSync('/proj/.raili', { recursive: true } as any);
    fs.mkdirSync('/proj/.raili/main', { recursive: true } as any);

    expect(getWorkflowName('/proj')).toBe('main');
  });

  test('returns provided name when provided', () => {
    const fs = getFileSystem();
    fs.mkdirSync('/repo', { recursive: true } as any);
    fs.mkdirSync('/repo/.raili', { recursive: true } as any);
    fs.mkdirSync('/repo/.raili/dev', { recursive: true } as any);

    expect(getWorkflowName('/repo', 'dev')).toBe('dev');
  });

  test('trims slashes from workflowArg', () => {
    const fs = getFileSystem();
    fs.mkdirSync('/x', { recursive: true } as any);
    fs.mkdirSync('/x/.raili', { recursive: true } as any);
    fs.mkdirSync('/x/.raili/feature', { recursive: true } as any);

    expect(getWorkflowName('/x', '/feature/')).toBe('feature');
  });

  test('throws when missing main and no arg', () => {
    expect(() => getWorkflowName('/missing')).toThrow(/Unable to resolve workflow directory/);
  });
});
