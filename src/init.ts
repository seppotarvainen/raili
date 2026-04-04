import { getFileSystem } from './infrastructure/fileSystemProvider';
import path from 'path';

export function generateWorkflowYaml(_workflowName?: string): string {
  return [
    '# Raili Workflow Configuration',
    '# Defines the workflow state machine',
    '# Optional resolver files (place under the workflow dir):',
    '#   .raili/<workflow>/approval-resolver.js',
    "#   .raili/<workflow>/feedback-resolver.js",
    "#   .raili/<workflow>/trigger.js - Optional: Create .raili/<workflow>/trigger.js for event-driven runs via 'raili listen'",
    '',
    'initial: init',
    '',
    'states:',
    '  init:',
    '    type: engine',
    '    on:',
    '      PASSED: analyze',
    '',
    '  analyze:',
    '    type: agent',
    '    agent: analyzer.agent',
    '    approval:',
    '      question: "Is the analysis correct?"',
    '      PASSED: plan',
    '      FAILED: analyze',
    '',
    '  plan:',
    '    type: agent',
    '    agent: planner.agent',
    '    approval:',
    '      question: "Is the implementation plan correct?"',
    '      PASSED: execute',
    '      FAILED: plan',
    '',
    '  execute:',
    '    type: agent',
    '    agent: executor.agent',
    '    on:',
    '      PASSED: test',
    '      FAILED: execute',
    '',
    '  test:',
    '    type: script',
    '    script: test-runner',
    '    on:',
    '      PASSED: verify',
    '      FAILED: execute',
    '',
    '  verify:',
    '    type: agent',
    '    agent: verifier.agent',
    '    transitions:',
    '      tests_failed: execute',
    '      commit_required: commit',
    '      progress_incomplete: execute',
    '      ready_for_archive: archive',
    '',
    '  commit:',
    '    type: script',
    '    script: git-commit',
    '    on:',
    '      PASSED: verify',
    '      FAILED: commit',
    '',
    '  archive:',
    '    type: script',
    '    script: archive-part',
    '    transitions:',
    '      more_parts: analyze',
    '      no_more_parts: done',
    '',
    '  done:',
    '    type: engine',
    '',
  ].join('\n');
}

export function generateAgentRegistry(): Record<string, { path: string }> {
  return {
    'analyzer.agent': { path: './agents/analyzer.agent.md' },
    'planner.agent': { path: './agents/planner.agent.md' },
    'executor.agent': { path: './agents/executor.agent.md' },
    'verifier.agent': { path: './agents/verifier.agent.md' },
  };
}

export function generateScriptRegistry(): Record<string, { path: string }> {
  return {
    'archive-part': { path: './scripts/archive.sh' },
    'test-runner': { path: './scripts/run-tests.sh' },
    'git-commit': { path: './scripts/commit.sh' },
  };
}

export async function initCommand(cwd: string) {
  const fs = getFileSystem();
  const railiDir = path.join(cwd, '.raili');
  if (fs.existsSync(railiDir)) {
    // Do not overwrite existing files
    throw new Error('.raili/ already exists. Initialization aborted.');
  }

  fs.mkdirSync(railiDir, { recursive: true });

  // Create a default workflow directory 'main' for scoped artifacts
  const mainWorkflowDir = path.join(railiDir, 'main');
  fs.mkdirSync(mainWorkflowDir, { recursive: true });

  const workflowYaml = generateWorkflowYaml();
  const agentRegistry = JSON.stringify(generateAgentRegistry(), null, 2);
  const scriptRegistry = JSON.stringify(generateScriptRegistry(), null, 2);

  // Write registries at .raili root (shared)
  fs.writeFileSync(path.join(railiDir, 'agent-registry.json'), agentRegistry);
  fs.writeFileSync(path.join(railiDir, 'script-registry.json'), scriptRegistry);

  // Write workflow.yaml and vars.yaml into .raili/main/
  fs.writeFileSync(path.join(mainWorkflowDir, 'workflow.yaml'), workflowYaml);
  fs.writeFileSync(path.join(mainWorkflowDir, 'vars.yaml'), '# vars for main workflow\n');
  fs.mkdirSync(path.join(mainWorkflowDir, 'outputs'), { recursive: true });
  fs.mkdirSync(path.join(mainWorkflowDir, 'learnings'), { recursive: true });

  // Backwards-compatible: also write a top-level workflow.yaml if desired (leave absent to prefer scoped)
  return { created: true };
}
