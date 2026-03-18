import fs from 'fs';
import path from 'path';

export async function initCommand(cwd: string) {
  const railiDir = path.join(cwd, '.raili');
  if (fs.existsSync(railiDir)) {
    // Do not overwrite existing files
    throw new Error('.raili/ already exists. Initialization aborted.');
  }

  fs.mkdirSync(railiDir);

  const workflowYaml = [
    '# Raili Workflow Configuration',
    '# Defines the workflow state machine',
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
    '    on:',
    '      more_parts: analyze',
    '      no_more_parts: done',
    '',
    '  done:',
    '    type: engine',
    '',
  ].join('\n');
  const agentRegistry = JSON.stringify(
    {
      'analyzer.agent': { path: './agents/analyzer.agent.md' },
      'planner.agent': { path: './agents/planner.agent.md' },
      'executor.agent': { path: './agents/executor.agent.md' },
      'verifier.agent': { path: './agents/verifier.agent.md' },
    },
    null,
    2,
  );
  const scriptRegistry = JSON.stringify(
    {
      'archive-part': { path: './scripts/archive.sh' },
      'test-runner': { path: './scripts/run-tests.sh' },
      'git-commit': { path: './scripts/commit.sh' },
    },
    null,
    2,
  );

  fs.writeFileSync(path.join(railiDir, 'workflow.yaml'), workflowYaml);
  fs.writeFileSync(path.join(railiDir, 'agent-registry.json'), agentRegistry);
  fs.writeFileSync(path.join(railiDir, 'script-registry.json'), scriptRegistry);

  return { created: true };
}
