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
    'states:',
    '  analyze:',
    '    type: agent',
    '    agent: analyzer.agent',
    '  plan:',
    '    type: agent',
    '    agent: planner.agent',
    '  execute:',
    '    type: agent',
    '    agent: executor.agent',
    '  verify:',
    '    type: agent',
    '    agent: verifier.agent',
    '  archive:',
    '    type: script',
    '    script: archive-part',
    '',
  ].join('\n');
  const agentRegistry = JSON.stringify({
    'analyzer.agent': { path: './agents/analyzer.agent.md' },
    'planner.agent': { path: './agents/planner.agent.md' },
    'executor.agent': { path: './agents/executor.agent.md' },
    'verifier.agent': { path: './agents/verifier.agent.md' },
  }, null, 2);
  const scriptRegistry = JSON.stringify({
    'archive-part': './archive.sh'
  }, null, 2);

  fs.writeFileSync(path.join(railiDir, 'workflow.yaml'), workflowYaml);
  fs.writeFileSync(path.join(railiDir, 'agent-registry.json'), agentRegistry);
  fs.writeFileSync(path.join(railiDir, 'script-registry.json'), scriptRegistry);

  return { created: true };
}

