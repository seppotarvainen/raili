import path from 'path';
import { getFileSystem } from '../../../src/infrastructure/fileSystemProvider';
import { setupFakeFs } from '../infrastructure/fsFake.util';
import { resolveApprovalResolverPath, resolveFeedbackResolverPath, resolveTriggerPath } from '../../../src/context/pathUtils';

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
